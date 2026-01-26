import os
from pathlib import Path
from groq import Groq
from dotenv import load_dotenv

# --- DYNAMIC PATH LOADING ---
# This finds the .env file in the same folder as this script
current_dir = Path(__file__).parent.absolute()
env_path = current_dir / ".env"
load_dotenv(dotenv_path=env_path)

GROQ_API_KEY = os.environ.get('GROQ_API_KEY')

if not GROQ_API_KEY:
    raise ValueError(f"❌ GROQ_API_KEY not found at: {env_path}")

print(f"✅ Successfully loaded .env from: {env_path}")

client = Groq(api_key=GROQ_API_KEY)
MODEL_NAME = "llama-3.3-70b-versatile"


SYSTEM_PROMPT = """
You are a Senior Wealth Strategist & Affordability Expert. 

### ROLE
You are the "Fi Money AI Bridge" Reasoning Engine. You are a high-precision personal financial analyst integrated with a Firebase real-time database. Your purpose is to process raw financial records and provide actionable, data-driven insights.

### CONTEXT & DATA SOURCE
- Primary Data: User financial records (income, expenses, investments, liquid cash) fetched from Firebase.
- Currency: INR.
- Precision: You must treat all numbers with 100% accuracy. Do not round numbers unless requested.

### OPERATING GUIDELINES
1. DATA ANALYSIS: When data is provided, first categorize it into Assets, Liabilities, Income, and Expenses.
2. TREND RECOGNITION: Identify patterns such as "Lifestyle Creep," recurring subscriptions, or high-velocity spending categories.
3. COMPLEX REASONING: When asked complex queries (e.g., "Can I afford a 50k purchase next month?"), perform a "Stress Test" by projecting current cash flow, upcoming fixed bills, and a safety margin.
4. TRUTH-GROUNDING: Only answer based on the data provided. If data is missing for a specific date range, state: "I do not have data for [Date Range] to confirm this."

### CONSTRAINTS
- NEVER provide professional legal or tax advice. Always include a brief disclaimer: "This is an AI-generated analysis, not professional financial advice."
- SECURITY: Never suggest or ask for plain-text passwords or full credit card numbers.
- TONE: Professional, objective, and analytical. Use Markdown tables for comparing monthly data.

### OUTPUT FORMAT
- Start with a "Quick Snapshot" (3-4 bullet points).
- Use "Deep Dive" for the mathematical breakdown of complex queries.
- End with one "Actionable Step."
"""

financial_tools = [
    {
        "type": "function",
        "function": {
            "name": "fetch_epf_details",
            "description": "Retrieve Employee Provident Fund (EPF) balance and contribution history.",
            "parameters": {
                "type": "object",
                "properties": {
                    "request_type": {"type": "string", "enum": ["summary", "detailed"], "default": "summary"}
                }
            }
        }
    },{
        "type": "function",
        "function": {
            "name": "fetch_net_worth",
            "description": "Get balances across accounts with historical range support.",
            "parameters": {
                "type": "object", 
                "properties": {
                    "request_type": {"type": "string", "enum": ["summary", "detailed"]},
                    "days": {"type": "integer", "default": 30} # ADDED: For historical trends
                }
            }
        }
    },{
        "type": "function",
        "function": {
            "name": "fetch_bank_transactions",
            "description": "Retrieve bank transactions for a specific period.",
            "parameters": {
                "type": "object", 
                "properties": { "days": {"type": "integer", "default": 30} }
            }
        }
    },{
        "type": "function",
        "function": {
            "name": "fetch_mf_transactions",
            "description": "Retrieve recent transaction history for Mutual Fund investments.",
            "parameters": {
                "type": "object", 
                "properties": {
                    "days": {"type": "integer", "default": 30}
                }
            }
        }
    },{
        "type": "function",
        "function": {
            "name": "fetch_stock_transactions",
            "description": "Retrieve recent buy/sell history for Stocks.",
            "parameters": {
                "type": "object", 
                "properties": {
                    "days": {"type": "integer", "default": 30}
                }
            }
        }
    },{
        "type": "function",
        "function": {
            "name": "fetch_credit_report",
            "description": "Retrieve the latest credit score and detailed credit report summary.",
            "parameters": {
                "type": "object",
                "properties": {} 
            }
        }
    }
]

def get_advisor_decision(user_query, chat_history=None):
    """Analyzes query with robust error handling for Groq API."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if chat_history:
        messages.extend(chat_history)
    messages.append({"role": "user", "content": user_query})
    
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            tools=financial_tools,
            tool_choice="auto",
            temperature=0.1
        )
        return response.choices[0].message
    except Exception as e:
        # ERROR HANDLING: Catches timeouts and rate limits
        print(f"⚠️ Groq API Error: {e}")
        return None