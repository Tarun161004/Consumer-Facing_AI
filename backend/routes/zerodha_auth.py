"""
Zerodha OAuth callback and auth status routes.
"""
import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import HTMLResponse
from backend.firebase_config import verify_firebase_token
from backend.zerodha_provider import (
    exchange_token, save_access_token,
    is_zerodha_authenticated, get_kite_login_url
)

logger = logging.getLogger("zerodha_auth")
router = APIRouter(prefix="/api/zerodha", tags=["Zerodha"])


@router.get("/login")
async def zerodha_login(token_data: dict = Depends(verify_firebase_token)):
    """Returns the Zerodha OAuth login URL for the current user."""
    uid = token_data["uid"]
    return {"login_url": get_kite_login_url(uid)}


@router.get("/callback")
async def zerodha_callback(request: Request):
    """
    Zerodha OAuth callback. Called by Zerodha after user login.
    Exchanges request_token for access_token and stores it.
    NOTE: The uid is passed as a query parameter for simplicity.
    """
    request_token = request.query_params.get("request_token")
    # uid is forwarded by Zerodha via redirect_params as ?uid=...
    uid = request.query_params.get("uid") or request.query_params.get("state")

    if not request_token or not uid:
        raise HTTPException(status_code=400, detail="Missing request_token or state (uid)")

    try:
        session = exchange_token(request_token)
        access_token = session["access_token"]
        save_access_token(uid, access_token)
        logger.info(f"Zerodha auth successful for user {uid[:8]}")
        return HTMLResponse(content="""
            <html>
            <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0f172a;color:white;">
                <h2 style="color:#22c55e">✅ Zerodha Connected Successfully!</h2>
                <p>You can close this tab and return to the Fi AI Agent.</p>
                <script>
                    setTimeout(() => window.close(), 3000);
                </script>
            </body>
            </html>
        """)
    except Exception as e:
        logger.error(f"Zerodha callback error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Zerodha auth failed: {str(e)}")


@router.get("/status")
async def zerodha_status(token_data: dict = Depends(verify_firebase_token)):
    """Check if user has a valid Zerodha access token today."""
    uid = token_data["uid"]
    authenticated = is_zerodha_authenticated(uid)
    return {
        "authenticated": authenticated,
        "login_url": get_kite_login_url(uid) if not authenticated else None
    }


@router.post("/manual-data")
async def save_manual_data(
    request: Request,
    token_data: dict = Depends(verify_firebase_token)
):
    """Save manually entered user financial data (EPF, credit score)."""
    uid = token_data["uid"]
    body = await request.json()
    epf_balance = body.get("epf_balance", 0)
    credit_score = body.get("credit_score", 0)

    from backend.firebase_config import get_firestore_client
    from google.cloud.firestore_v1 import DELETE_FIELD
    db = get_firestore_client()
    update_data = {}
    if epf_balance:
        update_data["epf_balance"] = float(epf_balance)
        # Clear stale cached error snapshot so dashboard uses manual data
        update_data["latest_fetch_epf_details"] = DELETE_FIELD
    if credit_score:
        update_data["credit_score"] = int(credit_score)
        # Clear stale cached error snapshot so dashboard uses manual data
        update_data["latest_fetch_credit_report"] = DELETE_FIELD

    if update_data:
        db.collection("users").document(uid).set(update_data, merge=True)
        # Also clear the net_worth snapshot so it gets rebuilt with new EPF
        if epf_balance:
            db.collection("users").document(uid).update({
                "latest_fetch_net_worth": DELETE_FIELD,
            })

    return {"detail": "Saved", "updated": list(update_data.keys())}
