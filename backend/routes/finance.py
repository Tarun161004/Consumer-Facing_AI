import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from backend.firebase_config import verify_firebase_token, get_firestore_client
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger("finance")
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/finance", tags=["Finance"])

# Allowlist of valid tool names to prevent injection
VALID_TOOL_NAMES = {
    "fetch_epf_details",
    "fetch_net_worth",
    "fetch_bank_transactions",
    "fetch_mf_transactions",
    "fetch_stock_transactions",
    "fetch_credit_report",
}


@router.get("/upload-status")
@limiter.limit("30/minute")
async def get_upload_status(
    request: Request,
    token_data: dict = Depends(verify_firebase_token),
):
    """Returns whether a bank statement has been uploaded."""
    uid = token_data["uid"]
    db = get_firestore_client()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return {"bank_statement_uploaded": False}
    data = doc.to_dict()
    return {
        "bank_statement_uploaded": data.get("bank_statement_uploaded", False),
        "bank_statement_filename": data.get("bank_statement_filename"),
        "bank_balance": data.get("bank_balance"),
    }


@router.get("/snapshot/{tool_name}")
@limiter.limit("30/minute")
async def get_snapshot(
    request: Request,
    tool_name: str,
    token_data: dict = Depends(verify_firebase_token),
):
    """
    Returns the latest saved financial snapshot for a specific tool.
    Rate limited to 30 requests per minute per IP.
    """
    # Validate tool_name against allowlist
    if tool_name not in VALID_TOOL_NAMES:
        raise HTTPException(status_code=400, detail="Invalid tool name.")

    uid = token_data["uid"]
    db = get_firestore_client()

    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User profile not found.")

    raw = doc.to_dict().get(f"latest_{tool_name}")
    user_data = doc.to_dict()

    # --- Net Worth: always merge manual EPF into the response ---
    if tool_name == "fetch_net_worth":
        epf_balance = float(user_data.get("epf_balance") or 0)
        bank_balance = float(user_data.get("bank_balance") or 0)

        if raw is not None:
            # Cached snapshot exists — merge manual EPF into it
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict) and "breakdown" in parsed:
                    parsed["breakdown"]["epf"] = epf_balance
                    # Recalculate total net worth with EPF
                    b = parsed["breakdown"]
                    parsed["net_worth"] = round(
                        float(b.get("stocks", 0)) +
                        float(b.get("mutual_funds", 0)) +
                        float(b.get("bank_balance", 0)) +
                        epf_balance, 2
                    )
                return {"tool_name": tool_name, "data": parsed}
            except json.JSONDecodeError:
                pass

        # No cached data — build from manual entries
        partial_nw = round(bank_balance + epf_balance, 2)
        fallback = {
            "net_worth": partial_nw,
            "breakdown": {
                "bank_balance": round(bank_balance, 2),
                "epf": round(epf_balance, 2),
                "stocks": 0,
                "mutual_funds": 0,
            },
            "source": "bank_statement + manual_epf (Zerodha not connected)",
        }
        return {"tool_name": tool_name, "data": fallback}

    # --- EPF: prefer manual entry, fallback to cached snapshot ---
    if tool_name == "fetch_epf_details":
        epf_balance = float(user_data.get("epf_balance") or 0)
        if epf_balance > 0:
            return {"tool_name": tool_name, "data": {
                "epf_balance": epf_balance,
                "source": "manual_entry",
            }}

    # --- Credit Score: prefer manual entry, fallback to cached snapshot ---
    if tool_name == "fetch_credit_report":
        credit_score = int(user_data.get("credit_score") or 0)
        if credit_score > 0:
            rating = (
                "Excellent" if credit_score >= 750 else
                "Good" if credit_score >= 700 else
                "Fair" if credit_score >= 650 else "Poor"
            )
            return {"tool_name": tool_name, "data": {
                "credit_score": credit_score,
                "rating": rating,
                "source": "manual_entry",
            }}

    # --- Generic: return cached snapshot or 404 ---
    if raw is None:
        raise HTTPException(
            status_code=404,
            detail=f"No snapshot found for '{tool_name}'. Chat with the AI first to fetch data.",
        )

    try:
        parsed = json.loads(raw)
        logger.info(f"[DEBUG] Snapshot '{tool_name}' keys: {list(parsed.keys()) if isinstance(parsed, dict) else type(parsed).__name__}")
        logger.info(f"[DEBUG] Snapshot '{tool_name}' data (first 500 chars): {str(parsed)[:500]}")
        return {"tool_name": tool_name, "data": parsed}
    except json.JSONDecodeError:
        return {"tool_name": tool_name, "data": raw}


@router.get("/history")
@limiter.limit("30/minute")
async def get_history(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    token_data: dict = Depends(verify_firebase_token),
):
    """
    Returns the user's financial history snapshots, most recent first.
    Rate limited to 30 requests per minute per IP.
    Limit capped at 100 max.
    """
    uid = token_data["uid"]
    db = get_firestore_client()

    history_ref = (
        db.collection("users")
        .document(uid)
        .collection("finance_history")
        .order_by("timestamp", direction="DESCENDING")
        .limit(limit)
    )

    docs = history_ref.stream()
    results = []
    for doc in docs:
        d = doc.to_dict()
        results.append(
            {
                "id": doc.id,
                "type": d.get("type"),
                "data": json.loads(d["data"]) if isinstance(d.get("data"), str) else d.get("data"),
                "timestamp": str(d.get("timestamp", "")),
            }
        )

    return {"history": results, "count": len(results)}


@router.delete("/history/{doc_id}")
@limiter.limit("30/minute")
async def delete_history_entry(
    request: Request,
    doc_id: str,
    token_data: dict = Depends(verify_firebase_token),
):
    """
    Deletes a single finance history entry by document ID.
    Only the owning user can delete their own entries.
    """
    uid = token_data["uid"]
    db = get_firestore_client()

    doc_ref = (
        db.collection("users")
        .document(uid)
        .collection("finance_history")
        .document(doc_id)
    )
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="History entry not found.")

    doc_ref.delete()
    return {"detail": "Deleted", "id": doc_id}


@router.delete("/history")
@limiter.limit("10/minute")
async def clear_all_history(
    request: Request,
    token_data: dict = Depends(verify_firebase_token),
):
    """
    Deletes all finance history entries for the authenticated user.
    Rate limited to 10 requests per minute per IP.
    """
    uid = token_data["uid"]
    db = get_firestore_client()

    history_ref = (
        db.collection("users")
        .document(uid)
        .collection("finance_history")
    )

    docs = history_ref.stream()
    deleted = 0
    for doc in docs:
        doc.reference.delete()
        deleted += 1

    return {"detail": "All history cleared", "deleted": deleted}
