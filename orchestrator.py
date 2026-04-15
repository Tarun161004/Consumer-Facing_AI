import asyncio
import json
import os
from brain_engine import get_advisor_decision, client, MODEL_NAME, SYSTEM_PROMPT
from fi_finance_agent import streamablehttp_client, ClientSession
from onboarding import FinancialAgentModule1

FI_SERVER_URL = os.environ.get("FI_SERVER_URL", "https://mcp.fi.money:8080/mcp/stream")

async def run_finance_agent():
    print("\n🚀 Starting Firebase-Integrated Finance Agent...")
    
    # Initialize Firebase Module
    fb_agent = FinancialAgentModule1()
    # DEV ONLY — replace with dynamic UID from authentication in production
    test_uid = "BB4UcGSnBJQHTC0uoMBwVjNTUeK2"
    chat_history = [] 

    try:
        async with streamablehttp_client(FI_SERVER_URL) as (read_stream, write_stream, _):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                
                # Initial Auth Check
                auth_probe = await session.call_tool("fetch_net_worth", arguments={})
                if "wealth-mcp-login" in auth_probe.content[0].text:
                    print(f"\n🔐 AUTH REQUIRED: {auth_probe.content[0].text}")
                    input("👉 Press ENTER after logging in...")

                while True:
                    user_query = input("\n👤 User: ")
                    if user_query.lower() in ["exit", "quit"]: break

                    decision = get_advisor_decision(user_query, chat_history)

                    if hasattr(decision, 'tool_calls') and decision.tool_calls:
                        turn_messages = [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            *chat_history,
                            {"role": "user", "content": user_query},
                            decision 
                        ]

                        for tool_call in decision.tool_calls:
                            tool_name = tool_call.function.name
                            print(f"--- ⚙️ Fetching {tool_name} from Fi Money... ---")
                            
                            try:
                                result = await asyncio.wait_for(session.call_tool(tool_name, {}), timeout=30.0)
                                bank_data_raw = result.content[0].text
                                
                                # --- NEW: SYNC DATA TO FIREBASE ---
                                try:
                                    bank_json = json.loads(bank_data_raw)
                                    fb_agent.save_history_snapshot(test_uid, bank_json, tool_name)
                                    # fb_agent.sync_financial_data(test_uid, bank_json)
                                    print("--- ✅ Live Data Synced to Firebase ---")
                                except Exception:
                                    print("--- ⚠️ Sync Warning: Data was not in JSON format ---")

                                turn_messages.append({
                                    "tool_call_id": tool_call.id,
                                    "role": "tool",
                                    "name": tool_name,
                                    "content": bank_data_raw,
                                })
                            except Exception as tool_err:
                                print(f"⚠️ Tool Error: {tool_err}")
                                turn_messages.append({
                                    "tool_call_id": tool_call.id,
                                    "role": "tool",
                                    "name": tool_name,
                                    "content": "Error: Bank server timeout.",
                                })

                        final_res = client.chat.completions.create(model=MODEL_NAME, messages=turn_messages)
                        ai_message = final_res.choices[0].message.content
                    else:
                        ai_message = decision.content

                    print(f"\n🤖 AI: {ai_message}")
                    chat_history.append({"role": "user", "content": user_query})
                    chat_history.append({"role": "assistant", "content": ai_message})

    except Exception as e:
        print(f"\n🛑 Connection Lost: {e}")

if __name__ == "__main__":
    asyncio.run(run_finance_agent())