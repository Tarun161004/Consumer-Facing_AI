import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from backend.firebase_config import verify_firebase_token, get_firestore_client
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel, Field
from typing import Literal

logger = logging.getLogger("chat_history")
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/chat-history", tags=["Chat History"])


class MessageItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=5000)
    timestamp: int


class SaveConversationRequest(BaseModel):
    messages: list[MessageItem] = Field(..., max_length=200)


@router.post("/save")
@limiter.limit("20/minute")
async def save_conversation(
    request: Request,
    body: SaveConversationRequest,
    token_data: dict = Depends(verify_firebase_token),
):
    """Save the current chat conversation to Firestore."""
    uid = token_data["uid"]
    db = get_firestore_client()

    if not body.messages:
        raise HTTPException(status_code=400, detail="No messages to save.")

    # Use the first user message as title, or fallback
    title = "Chat"
    for m in body.messages:
        if m.role == "user":
            title = m.content[:80]
            break

    doc_ref = (
        db.collection("users")
        .document(uid)
        .collection("chat_history")
        .document()
    )

    doc_ref.set({
        "title": title,
        "messages": [m.model_dump() for m in body.messages],
        "message_count": len(body.messages),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"id": doc_ref.id, "detail": "Conversation saved"}


@router.get("")
@limiter.limit("30/minute")
async def list_conversations(
    request: Request,
    limit: int = Query(default=30, ge=1, le=100),
    token_data: dict = Depends(verify_firebase_token),
):
    """List all saved conversations (metadata only, no messages)."""
    uid = token_data["uid"]
    db = get_firestore_client()

    docs = (
        db.collection("users")
        .document(uid)
        .collection("chat_history")
        .order_by("created_at", direction="DESCENDING")
        .limit(limit)
        .stream()
    )

    results = []
    for doc in docs:
        d = doc.to_dict()
        results.append({
            "id": doc.id,
            "title": d.get("title", "Chat"),
            "message_count": d.get("message_count", 0),
            "created_at": d.get("created_at", ""),
            "updated_at": d.get("updated_at", ""),
        })

    return {"conversations": results, "count": len(results)}


@router.get("/{conv_id}")
@limiter.limit("30/minute")
async def get_conversation(
    request: Request,
    conv_id: str,
    token_data: dict = Depends(verify_firebase_token),
):
    """Load a specific conversation with all messages."""
    uid = token_data["uid"]
    db = get_firestore_client()

    doc = (
        db.collection("users")
        .document(uid)
        .collection("chat_history")
        .document(conv_id)
        .get()
    )

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    d = doc.to_dict()
    return {
        "id": doc.id,
        "title": d.get("title", "Chat"),
        "messages": d.get("messages", []),
        "created_at": d.get("created_at", ""),
    }


@router.delete("/{conv_id}")
@limiter.limit("20/minute")
async def delete_conversation(
    request: Request,
    conv_id: str,
    token_data: dict = Depends(verify_firebase_token),
):
    """Delete a single conversation."""
    uid = token_data["uid"]
    db = get_firestore_client()

    doc_ref = (
        db.collection("users")
        .document(uid)
        .collection("chat_history")
        .document(conv_id)
    )

    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    doc_ref.delete()
    return {"detail": "Deleted", "id": conv_id}


@router.delete("")
@limiter.limit("5/minute")
async def clear_all_conversations(
    request: Request,
    token_data: dict = Depends(verify_firebase_token),
):
    """Delete all chat history for the user."""
    uid = token_data["uid"]
    db = get_firestore_client()

    docs = (
        db.collection("users")
        .document(uid)
        .collection("chat_history")
        .stream()
    )

    deleted = 0
    for doc in docs:
        doc.reference.delete()
        deleted += 1

    return {"detail": "All conversations cleared", "deleted": deleted}
