"""
Bank Statement Upload Route.
Accepts PDF/CSV bank statement, parses it, and saves to Firestore.
"""
import logging
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Request
from backend.firebase_config import verify_firebase_token, get_firestore_client
from backend.statement_parser import parse_pdf_statement, parse_csv_statement
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger("upload")
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/finance", tags=["Finance"])


@router.post("/upload-statement")
@limiter.limit("10/minute")
async def upload_bank_statement(
    request: Request,
    file: UploadFile = File(...),
    token_data: dict = Depends(verify_firebase_token),
):
    """
    Upload a bank statement PDF or CSV.
    Parses transactions and saves to Firestore for AI analysis.
    """
    uid = token_data["uid"]
    filename = file.filename.lower()
    contents = await file.read()

    if len(contents) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=413, detail="File too large. Max 10MB.")

    if filename.endswith(".pdf"):
        result = parse_pdf_statement(contents)
    elif filename.endswith(".csv"):
        result = parse_csv_statement(contents)
    else:
        raise HTTPException(status_code=400, detail="Only PDF or CSV files are supported.")

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    # Save to Firestore
    db = get_firestore_client()
    import firebase_admin
    db.collection("users").document(uid).set(
        {
            "bank_transactions": result["transactions"],
            "bank_balance": result["bank_balance"],
            "monthly_income": result["monthly_income"],
            "monthly_expenses": result["monthly_expenses"],
            "bank_statement_uploaded": True,
            "bank_statement_filename": file.filename,
            "last_statement_sync": firebase_admin.firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )
    logger.info(f"Bank statement uploaded for user {uid[:8]}: {result['transaction_count']} transactions")

    return {
        "detail": "Statement uploaded and parsed successfully",
        "transaction_count": result["transaction_count"],
        "bank_balance": result["bank_balance"],
        "monthly_income": result["monthly_income"],
        "monthly_expenses": result["monthly_expenses"],
        "filename": file.filename,
    }


@router.delete("/remove-statement")
@limiter.limit("10/minute")
async def remove_bank_statement(
    request: Request,
    token_data: dict = Depends(verify_firebase_token),
):
    """Remove uploaded bank statement data from Firestore."""
    uid = token_data["uid"]
    db = get_firestore_client()
    from google.cloud.firestore_v1 import DELETE_FIELD

    db.collection("users").document(uid).update(
        {
            "bank_transactions": DELETE_FIELD,
            "bank_balance": DELETE_FIELD,
            "monthly_income": DELETE_FIELD,
            "monthly_expenses": DELETE_FIELD,
            "bank_statement_uploaded": DELETE_FIELD,
            "last_statement_sync": DELETE_FIELD,
            "bank_statement_filename": DELETE_FIELD,
        }
    )
    logger.info(f"Bank statement removed for user {uid[:8]}")
    return {"detail": "Bank statement data removed successfully"}
