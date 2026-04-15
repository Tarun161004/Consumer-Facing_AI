import asyncio
import json
import logging
from fastapi import APIRouter, Depends, Request
from backend.firebase_config import verify_firebase_token, get_firestore_client
from backend.schemas import ChatRequest, ChatResponse
from backend.zerodha_provider import call_tool, is_zerodha_authenticated, get_kite_login_url
from brain_engine import get_advisor_decision, client, MODEL_NAME, SYSTEM_PROMPT
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger("chat")
logging.basicConfig(level=logging.INFO)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("", response_model=ChatResponse)
@limiter.limit("10/minute")
async def chat(request: Request, req: ChatRequest, token_data: dict = Depends(verify_firebase_token)):
    """
    Main chat endpoint. Uses Zerodha Kite Connect for finance tool calls.
    Rate limited to 10 requests per minute per IP.
    """
    uid = token_data["uid"]
    logger.info(f"Chat request from user {uid[:8]}..., message length: {len(req.message)}")

    # Build chat history
    chat_history = [{"role": m.role, "content": m.content} for m in req.history]

    # --- Step 1: Get the AI advisor's decision ---
    try:
        decision = await asyncio.to_thread(get_advisor_decision, req.message, chat_history)
    except Exception as e:
        logger.error(f"AI engine error for user {uid[:8]}: {e}", exc_info=True)
        return ChatResponse(reply="⚠️ The AI engine is temporarily unavailable. Please try again in a moment.")

    if decision is None:
        logger.error(f"AI decision is None for user {uid[:8]}")
        return ChatResponse(reply="⚠️ AI engine unavailable. Please try again.")

    has_tools = bool(hasattr(decision, "tool_calls") and decision.tool_calls)
    logger.info(f"Has tool calls: {has_tools}")

    # --- Step 2: No tool call → direct AI response ---
    if not has_tools:
        return ChatResponse(reply=decision.content)

    # --- Step 3: Tool call needed → check Zerodha auth ---
    # Check if tool needs Zerodha (stock/mf/net_worth) but user is not authenticated
    zerodha_tools = {"fetch_stock_transactions", "fetch_mf_transactions", "fetch_net_worth"}
    needs_zerodha = any(
        tc.function.name in zerodha_tools for tc in decision.tool_calls
    )

    if needs_zerodha and not is_zerodha_authenticated(uid):
        login_url = get_kite_login_url(uid)
        return ChatResponse(
            reply="🔐 **Zerodha Login Required**\n\nI need to access your Zerodha portfolio to answer this question.\n\n**Steps:**\n1. Click **'Connect Zerodha'** below\n2. Login with your Zerodha credentials\n3. Come back and ask your question again",
            requires_mcp_auth=True,
            auth_url=login_url,
        )

    # --- Step 4: Execute tool calls ---
    turn_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *chat_history[-10:],  # Limit history to save tokens
        {"role": "user", "content": req.message},
        decision,
    ]

    tool_used = None
    data_synced = False

    for tool_call in decision.tool_calls:
        tool_name = tool_call.function.name
        tool_used = tool_name
        logger.info(f"Calling tool: {tool_name}")

        try:
            # Call tool via Zerodha provider (runs in thread — sync function)
            result_raw = await asyncio.to_thread(call_tool, tool_name, uid)
            logger.info(f"Tool {tool_name} returned {len(result_raw)} chars")

            # Check if it's an auth error
            result_json = json.loads(result_raw)
            if result_json.get("error") == "zerodha_auth_required":
                login_url = get_kite_login_url(uid)
                return ChatResponse(
                    reply="🔐 **Zerodha Login Required**\n\nYour Zerodha session has expired. Please reconnect.",
                    requires_mcp_auth=True,
                    auth_url=login_url,
                )

            # Sync to Firebase
            try:
                db = get_firestore_client()
                import firebase_admin
                user_ref = db.collection("users").document(uid)
                user_ref.set(
                    {
                        f"latest_{tool_name}": result_raw,
                        "last_sync": firebase_admin.firestore.SERVER_TIMESTAMP,
                        "uid": uid,
                    },
                    merge=True,
                )
                user_ref.collection("finance_history").document().set(
                    {
                        "type": tool_name,
                        "data": result_raw,
                        "timestamp": firebase_admin.firestore.SERVER_TIMESTAMP,
                    }
                )
                data_synced = True
                logger.info(f"Data synced to Firebase for {tool_name}")
            except Exception as sync_err:
                logger.error(f"Firebase sync error: {sync_err}", exc_info=True)

            turn_messages.append(
                {
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": tool_name,
                    "content": result_raw,
                }
            )
        except asyncio.TimeoutError:
            logger.warning(f"Tool {tool_name} timed out")
            turn_messages.append(
                {
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": tool_name,
                    "content": "Error: Request timed out. Please try again.",
                }
            )
        except Exception as tool_err:
            logger.error(f"Tool {tool_name} error: {tool_err}", exc_info=True)
            turn_messages.append(
                {
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": tool_name,
                    "content": f"Error: Could not retrieve data. {str(tool_err)}",
                }
            )

    # --- Step 5: Get final AI synthesis ---
    # Truncate tool results if they're too large (Groq context window limit)
    for msg in turn_messages:
        if isinstance(msg, dict) and msg.get("role") == "tool" and isinstance(msg.get("content"), str):
            if len(msg["content"]) > 4000:
                logger.warning(f"Truncating tool result from {len(msg['content'])} to 4000 chars")
                msg["content"] = msg["content"][:4000] + '..."}'

    try:
        final_res = await asyncio.to_thread(
            client.chat.completions.create,
            model=MODEL_NAME,
            messages=turn_messages,
            max_tokens=4096,
        )
        ai_message = final_res.choices[0].message.content
        logger.info(f"Final response ready ({len(ai_message)} chars)")
    except Exception as e:
        logger.error(f"Final synthesis error ({type(e).__name__}): {e}", exc_info=True)
        ai_message = "⚠️ I retrieved your data but encountered an error generating the analysis. Please try again."

    return ChatResponse(
        reply=ai_message,
        tool_used=tool_used,
        data_synced=data_synced,
    )
