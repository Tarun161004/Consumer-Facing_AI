"""
Bank Statement Parser.

Supports PDF and CSV bank statements from major Indian banks.
Extracts transactions, calculates balance, income, and expenses.
"""
import io
import logging
import re
import pandas as pd

logger = logging.getLogger("statement_parser")


def parse_csv_statement(file_bytes: bytes) -> dict:
    """Parse a CSV bank statement."""
    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

        # Try to find common column names across banks
        date_col = next((c for c in df.columns if "date" in c), None)
        desc_col = next((c for c in df.columns if any(k in c for k in ["desc", "narr", "detail", "particular"])), None)
        debit_col = next((c for c in df.columns if "debit" in c or "withdrawal" in c), None)
        credit_col = next((c for c in df.columns if "credit" in c or "deposit" in c), None)
        balance_col = next((c for c in df.columns if "balance" in c), None)

        transactions = []
        for _, row in df.iterrows():
            try:
                debit = float(str(row.get(debit_col, 0) or 0).replace(",", "").replace(" ", "") or 0)
                credit = float(str(row.get(credit_col, 0) or 0).replace(",", "").replace(" ", "") or 0)
                balance = float(str(row.get(balance_col, 0) or 0).replace(",", "").replace(" ", "") or 0)
                desc = str(row.get(desc_col, "")).strip()
                date = str(row.get(date_col, "")).strip()

                if debit > 0 or credit > 0:
                    transactions.append({
                        "date": date,
                        "description": desc,
                        "debit": debit,
                        "credit": credit,
                        "balance": balance,
                        "type": "debit" if debit > 0 else "credit",
                    })
            except Exception:
                continue

        return _summarize_transactions(transactions)
    except Exception as e:
        logger.error(f"CSV parse error: {e}")
        return {"error": f"Could not parse CSV: {str(e)}"}


def _parse_amount(text: str) -> float:
    """Extract numeric amount from text, handling Indian formats like 1,50,000.00"""
    if not text:
        return 0.0
    cleaned = re.sub(r"[^\d.]", "", text.replace(",", ""))
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0


# Common date patterns in Indian bank statements
DATE_PATTERNS = [
    r"\d{2}[/-]\d{2}[/-]\d{4}",   # DD/MM/YYYY or DD-MM-YYYY
    r"\d{2}[/-]\d{2}[/-]\d{2}",   # DD/MM/YY or DD-MM-YY
    r"\d{4}[/-]\d{2}[/-]\d{2}",   # YYYY-MM-DD
    r"\d{2}\s+\w{3}\s+\d{4}",     # 01 Jan 2025
    r"\d{2}\w{3}\d{4}",           # 01Jan2025
]
DATE_RE = re.compile("|".join(f"({p})" for p in DATE_PATTERNS))

# Amount pattern: numbers with optional commas and decimal
AMOUNT_RE = re.compile(r"[\d,]+\.\d{2}")


def _parse_text_transactions(full_text: str) -> list:
    """Parse transactions from raw PDF text line by line using regex."""
    transactions = []
    lines = full_text.split("\n")

    for line in lines:
        line = line.strip()
        if not line or len(line) < 10:
            continue

        # Find a date in the line
        date_match = DATE_RE.search(line)
        if not date_match:
            continue

        date_str = date_match.group(0)

        # Find all amounts in the line
        amounts = AMOUNT_RE.findall(line)
        if not amounts:
            continue

        # Parse amounts
        parsed_amounts = [_parse_amount(a) for a in amounts]
        parsed_amounts = [a for a in parsed_amounts if a > 0]

        if not parsed_amounts:
            continue

        # Extract description: text between date and first amount
        date_end = date_match.end()
        first_amt_match = AMOUNT_RE.search(line[date_end:])
        if first_amt_match:
            desc = line[date_end:date_end + first_amt_match.start()].strip()
        else:
            desc = line[date_end:].strip()

        # Clean description
        desc = re.sub(r"\s+", " ", desc).strip(" /-|")
        if not desc or len(desc) < 3:
            desc = "Transaction"

        # Determine debit/credit/balance based on number of amounts
        if len(parsed_amounts) >= 3:
            # Format: debit, credit, balance (common in SBI/HDFC)
            debit = parsed_amounts[0] if parsed_amounts[0] > 0 else 0
            credit = parsed_amounts[1] if parsed_amounts[1] > 0 else 0
            balance = parsed_amounts[2]
            # If debit and credit are same, it's likely amount + balance
            if debit == credit:
                debit = parsed_amounts[0]
                credit = 0
                balance = parsed_amounts[-1]
        elif len(parsed_amounts) == 2:
            # Format: amount, balance
            balance = parsed_amounts[-1]
            amount = parsed_amounts[0]
            # Heuristic: if description has DR/debit keywords
            is_debit = any(k in line.lower() for k in ["dr", "debit", "withdrawal", "atm", "upi/", "neft/", "paid"])
            debit = amount if is_debit else 0
            credit = 0 if is_debit else amount
        else:
            # Single amount — try to guess
            amount = parsed_amounts[0]
            is_debit = any(k in line.lower() for k in ["dr", "debit", "withdrawal", "atm", "paid"])
            debit = amount if is_debit else 0
            credit = 0 if is_debit else amount
            balance = 0

        if debit > 0 or credit > 0:
            transactions.append({
                "date": date_str,
                "description": desc[:100],
                "debit": debit,
                "credit": credit,
                "balance": balance,
                "type": "debit" if debit > 0 else "credit",
            })

    return transactions


def parse_pdf_statement(file_bytes: bytes) -> dict:
    """Parse a PDF bank statement using pdfplumber — tries tables first, then text."""
    try:
        import pdfplumber
        transactions = []

        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            # --- METHOD 1: Table extraction ---
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    header = [str(h).strip().lower() if h else "" for h in table[0]]
                    date_idx = next((i for i, h in enumerate(header) if "date" in h), None)
                    desc_idx = next((i for i, h in enumerate(header) if any(k in h for k in ["desc", "narr", "detail", "particular"])), None)
                    debit_idx = next((i for i, h in enumerate(header) if "debit" in h or "withdrawal" in h), None)
                    credit_idx = next((i for i, h in enumerate(header) if "credit" in h or "deposit" in h), None)
                    balance_idx = next((i for i, h in enumerate(header) if "balance" in h), None)

                    if debit_idx is None and credit_idx is None:
                        continue

                    for row in table[1:]:
                        try:
                            debit = _parse_amount(str(row[debit_idx]) if debit_idx is not None and debit_idx < len(row) else "")
                            credit = _parse_amount(str(row[credit_idx]) if credit_idx is not None and credit_idx < len(row) else "")
                            balance = _parse_amount(str(row[balance_idx]) if balance_idx is not None and balance_idx < len(row) else "")
                            date = str(row[date_idx]).strip() if date_idx is not None and date_idx < len(row) else ""
                            desc = str(row[desc_idx]).strip() if desc_idx is not None and desc_idx < len(row) else ""

                            if debit > 0 or credit > 0:
                                transactions.append({
                                    "date": date,
                                    "description": desc[:100],
                                    "debit": debit,
                                    "credit": credit,
                                    "balance": balance,
                                    "type": "debit" if debit > 0 else "credit",
                                })
                        except Exception:
                            continue

            # --- METHOD 2: Text-based fallback ---
            if not transactions:
                logger.info("Table extraction failed, trying text-based parsing...")
                full_text = ""
                for page in pdf.pages:
                    full_text += (page.extract_text() or "") + "\n"
                transactions = _parse_text_transactions(full_text)

        if not transactions:
            return {"error": "Could not find transactions in this PDF. Please try CSV format from your bank's net banking."}
        
        logger.info(f"Parsed {len(transactions)} transactions from PDF")
        return _summarize_transactions(transactions)

    except ImportError:
        return {"error": "pdfplumber not installed. Run: pip install pdfplumber"}
    except Exception as e:
        logger.error(f"PDF parse error: {e}")
        return {"error": f"Could not parse PDF: {str(e)}"}


def _summarize_transactions(transactions: list) -> dict:
    """Calculate summary statistics from parsed transactions."""
    if not transactions:
        return {"error": "No transactions found"}

    total_credits = sum(t["credit"] for t in transactions)
    total_debits = sum(t["debit"] for t in transactions)
    last_balance = transactions[-1].get("balance", 0) if transactions else 0

    # Estimate monthly figures (assume data spans ~3 months)
    months = max(1, len(transactions) // 30)
    monthly_income = round(total_credits / months, 2)
    monthly_expenses = round(total_debits / months, 2)

    return {
        "transactions": transactions,
        "bank_balance": last_balance,
        "total_credits": round(total_credits, 2),
        "total_debits": round(total_debits, 2),
        "monthly_income": monthly_income,
        "monthly_expenses": monthly_expenses,
        "transaction_count": len(transactions),
    }
