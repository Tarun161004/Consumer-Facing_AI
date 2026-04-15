"""
Zerodha Kite Connect Provider.

Replaces the Fi Money MCP session with Zerodha Kite Connect API.
Each user authenticates via OAuth and their access_token is stored in Firestore.
Tool calls are mapped to Zerodha Kite Connect REST API calls.
"""
import json
import logging
import os
import time
from kiteconnect import KiteConnect
from backend.firebase_config import get_firestore_client

logger = logging.getLogger("zerodha_provider")

ZERODHA_API_KEY = os.environ.get("ZERODHA_API_KEY", "")
ZERODHA_API_SECRET = os.environ.get("ZERODHA_API_SECRET", "")


def get_kite_login_url(uid: str = "") -> str:
    """Returns the Zerodha OAuth login URL, with uid passed via redirect_params."""
    kite = KiteConnect(api_key=ZERODHA_API_KEY)
    url = kite.login_url()
    if uid:
        # Zerodha forwards redirect_params back to the callback URL
        from urllib.parse import quote
        url += f"&redirect_params=uid%3D{quote(uid)}"
    return url


def exchange_token(request_token: str) -> dict:
    """Exchange request_token for access_token."""
    kite = KiteConnect(api_key=ZERODHA_API_KEY)
    session = kite.generate_session(request_token, api_secret=ZERODHA_API_SECRET)
    return session


def get_kite_for_user(uid: str) -> KiteConnect | None:
    """Get an authenticated KiteConnect instance for a user using stored access_token.
    Validates the token before returning. If invalid/expired, clears it."""
    db = get_firestore_client()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    access_token = data.get("zerodha_access_token")
    token_date = data.get("zerodha_token_date", "")
    today = time.strftime("%Y-%m-%d")
    if not access_token or token_date != today:
        return None  # Token expired or missing
    kite = KiteConnect(api_key=ZERODHA_API_KEY)
    kite.set_access_token(access_token)
    # Validate token by making a lightweight API call
    try:
        kite.profile()  # Quick check — if token is invalid, this throws
    except Exception as e:
        logger.warning(f"Zerodha token invalid for user {uid[:8]}: {e}")
        # Clear the stale token so user gets a fresh auth prompt
        db.collection("users").document(uid).update({
            "zerodha_access_token": "",
            "zerodha_token_date": "",
        })
        return None
    return kite


def save_access_token(uid: str, access_token: str):
    """Save access_token to Firestore for a user."""
    db = get_firestore_client()
    db.collection("users").document(uid).set(
        {
            "zerodha_access_token": access_token,
            "zerodha_token_date": time.strftime("%Y-%m-%d"),
        },
        merge=True,
    )


def is_zerodha_authenticated(uid: str) -> bool:
    """Check if user has a valid Zerodha access token."""
    return get_kite_for_user(uid) is not None


# ─── TOOL IMPLEMENTATIONS ─────────────────────────────────────────────────────

def fetch_stock_transactions(uid: str) -> str:
    """Fetch user's stock holdings and positions from Zerodha."""
    kite = get_kite_for_user(uid)
    if not kite:
        return json.dumps({"error": "zerodha_auth_required"})
    try:
        holdings = kite.holdings()
        positions = kite.positions()
        total_value = sum(
            h.get("last_price", 0) * h.get("quantity", 0) for h in holdings
        )
        return json.dumps({
            "holdings": holdings,
            "positions": positions.get("net", []),
            "total_holdings_value": round(total_value, 2),
            "source": "zerodha_kite"
        })
    except Exception as e:
        logger.error(f"fetch_stock_transactions error: {e}")
        return json.dumps({"error": str(e)})


def fetch_mf_transactions(uid: str) -> str:
    """Fetch user's mutual fund holdings from Zerodha Coin."""
    kite = get_kite_for_user(uid)
    if not kite:
        return json.dumps({"error": "zerodha_auth_required"})
    try:
        mf_holdings = kite.mf_holdings()
        mf_orders = kite.mf_orders()
        total_value = sum(
            h.get("last_price", 0) * h.get("quantity", 0) for h in mf_holdings
        )
        return json.dumps({
            "mf_holdings": mf_holdings,
            "mf_orders": mf_orders[:20],  # last 20 orders
            "total_mf_value": round(total_value, 2),
            "source": "zerodha_coin"
        })
    except Exception as e:
        logger.error(f"fetch_mf_transactions error: {e}")
        return json.dumps({"error": str(e)})


def fetch_net_worth(uid: str) -> str:
    """Calculate net worth from Zerodha holdings + bank statement data."""
    kite = get_kite_for_user(uid)
    if not kite:
        return json.dumps({"error": "zerodha_auth_required"})
    try:
        # Get stock value
        holdings = kite.holdings()
        stock_value = sum(
            h.get("last_price", 0) * h.get("quantity", 0) for h in holdings
        )
        # Get MF value
        mf_holdings = kite.mf_holdings()
        mf_value = sum(
            h.get("last_price", 0) * h.get("quantity", 0) for h in mf_holdings
        )
        # Get bank balance from Firestore (uploaded statement data)
        db = get_firestore_client()
        doc = db.collection("users").document(uid).get()
        bank_balance = 0
        epf_balance = 0
        if doc.exists:
            data = doc.to_dict()
            bank_balance = data.get("bank_balance", 0)
            epf_balance = data.get("epf_balance", 0)

        total = stock_value + mf_value + bank_balance + epf_balance
        return json.dumps({
            "net_worth": round(total, 2),
            "breakdown": {
                "stocks": round(stock_value, 2),
                "mutual_funds": round(mf_value, 2),
                "bank_balance": round(bank_balance, 2),
                "epf": round(epf_balance, 2),
            },
            "source": "zerodha_kite + bank_statement + manual_epf"
        })
    except Exception as e:
        logger.error(f"fetch_net_worth error: {e}")
        return json.dumps({"error": str(e)})


def fetch_bank_transactions(uid: str) -> str:
    """Fetch bank transaction data from uploaded statement (stored in Firestore)."""
    db = get_firestore_client()
    logger.info(f"fetch_bank_transactions called for uid: {uid}")
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        logger.warning(f"No Firestore document found for uid: {uid}")
        return json.dumps({"error": "No bank statement uploaded. Please upload your bank statement first."})
    data = doc.to_dict()
    logger.info(f"Firestore doc keys for uid {uid[:8]}: {list(data.keys())}")
    transactions = data.get("bank_transactions", [])
    bank_balance = data.get("bank_balance", 0)
    monthly_income = data.get("monthly_income", 0)
    monthly_expenses = data.get("monthly_expenses", 0)
    if not transactions:
        logger.warning(f"No bank_transactions found in Firestore for uid: {uid[:8]}, available keys: {list(data.keys())}")
        return json.dumps({"error": "No bank statement uploaded. Please upload your bank statement first."})
    return json.dumps({
        "transactions": transactions[:50],  # last 50 transactions
        "bank_balance": bank_balance,
        "monthly_income": monthly_income,
        "monthly_expenses": monthly_expenses,
        "transaction_count": len(transactions),
        "source": "bank_statement_upload"
    })


def fetch_epf_details(uid: str) -> str:
    """Fetch EPF details from manually entered user data."""
    db = get_firestore_client()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return json.dumps({"error": "No EPF data found. Please add your EPF balance in Profile settings."})
    data = doc.to_dict()
    epf_balance = data.get("epf_balance", 0)
    if not epf_balance:
        return json.dumps({"error": "No EPF data found. Please add your EPF balance in Profile settings."})
    return json.dumps({
        "epf_balance": epf_balance,
        "source": "manual_entry"
    })


def fetch_credit_report(uid: str) -> str:
    """Fetch credit report from manually entered user data."""
    db = get_firestore_client()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return json.dumps({"error": "No credit score found. Please add your credit score in Profile settings."})
    data = doc.to_dict()
    credit_score = data.get("credit_score", 0)
    if not credit_score:
        return json.dumps({"error": "No credit score found. Please add your credit score in Profile settings."})
    return json.dumps({
        "credit_score": credit_score,
        "rating": (
            "Excellent" if credit_score >= 750 else
            "Good" if credit_score >= 700 else
            "Fair" if credit_score >= 650 else "Poor"
        ),
        "source": "manual_entry"
    })


# ─── MAIN DISPATCHER ──────────────────────────────────────────────────────────

TOOL_MAP = {
    "fetch_stock_transactions": fetch_stock_transactions,
    "fetch_mf_transactions": fetch_mf_transactions,
    "fetch_net_worth": fetch_net_worth,
    "fetch_bank_transactions": fetch_bank_transactions,
    "fetch_epf_details": fetch_epf_details,
    "fetch_credit_report": fetch_credit_report,
}


def call_tool(tool_name: str, uid: str) -> str:
    """Dispatch a tool call to the correct Zerodha/data provider function."""
    fn = TOOL_MAP.get(tool_name)
    if not fn:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})
    return fn(uid)
