import os
import json
import firebase_admin
from firebase_admin import credentials, auth, firestore

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_KEY_PATH = os.path.join(BASE_DIR, "serviceAccountKey.json")

class FinancialAgentModule1:
    def __init__(self):
        if not firebase_admin._apps:
            if not os.path.exists(JSON_KEY_PATH):
                raise FileNotFoundError(f"Missing Key! Place 'serviceAccountKey.json' in {BASE_DIR}")
            cred = credentials.Certificate(JSON_KEY_PATH)
            firebase_admin.initialize_app(cred)
        self.db = firestore.client()
        print("--- Firebase Successfully Initialized ---")

    def onboard_user(self, phone_number, goals):
        try:
            try:
                user = auth.get_user_by_phone_number(phone_number)
                uid = user.uid
            except Exception:
                user = auth.create_user(phone_number=phone_number)
                uid = user.uid

            user_ref = self.db.collection("users").document(uid)
            user_ref.set({
                "phone": phone_number,
                "goals": goals,
                "status": "active",
                "last_login": firestore.SERVER_TIMESTAMP
            }, merge=True)
            return uid
        except Exception as e:
            return f"Onboarding Error: {str(e)}"

    def save_history_snapshot(self, uid, data, tool_name):
        """Saves data safely using merge logic to ensure creation if missing."""
        try:
            user_ref = self.db.collection("users").document(uid)
            flat_data = json.dumps(data) # Flattening complex bank JSON

            # FIX: Changed .update() to .set(merge=True) to prevent crashes
            user_ref.set({
                f"latest_{tool_name}": flat_data, 
                "last_sync": firestore.SERVER_TIMESTAMP,
                "uid": uid
            }, merge=True)
            
            history_ref = user_ref.collection("finance_history").document()
            history_ref.set({
                "type": tool_name,
                "data": flat_data,
                "timestamp": firestore.SERVER_TIMESTAMP
            })
            return True
        except Exception as e:
            print(f"⚠️ Firebase Sync Error: {e}")
            return False

    def get_last_snapshot(self, uid, tool_name):
        """NEW: Retrieves and parses the last saved data from Firebase for trend analysis."""
        try:
            user_ref = self.db.collection("users").document(uid)
            doc = user_ref.get()
            if doc.exists:
                raw_data = doc.to_dict().get(f"latest_{tool_name}")
                return json.loads(raw_data) if raw_data else None
        except Exception as e:
            print(f"Error reading history: {e}")
        return None

# --- MAIN LOOP FOR TESTING ---
if __name__ == "__main__":
    # 1. Initialize the module
    onboarding_manager = FinancialAgentModule1()
    
    # 2. Google Account UID (same as web frontend + orchestrator)
    test_uid = "BB4UcGSnBJQHTC0uoMBwVjNTUeK2"
    
    print(f"\n🚀 Testing onboarding for UID: {test_uid}")

    # 3. Test Snapshot Saving (Simulating complex/nested bank data)
    sample_bank_data = {
        "account_id": "fi_acc_123",
        "transactions": [
            {"date": "2026-01-20", "merchant": "Amazon", "amount": 1200.50},
            {"date": "2026-01-21", "merchant": "Zomato", "amount": 450.00}
        ],
        "meta": {"status": "success", "internal_code": 200}
    }

    print(f"\n⚙️ Testing Snapshot Sync for 'fetch_bank_transactions'...")
    success = onboarding_manager.save_history_snapshot(test_uid, sample_bank_data, "fetch_bank_transactions")
    
    if success:
        print("✅ Success! Data flattened and saved to Firestore.")
    else:
        print("❌ Failed! Check the Sync Error logs above.")