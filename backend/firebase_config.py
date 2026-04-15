import os
import firebase_admin
from firebase_admin import credentials, auth, firestore
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_KEY_PATH = os.path.join(BASE_DIR, "serviceAccountKey.json")

security = HTTPBearer()


def init_firebase():
    """Initialize Firebase Admin SDK (called once at startup)."""
    if not firebase_admin._apps:
        if not os.path.exists(JSON_KEY_PATH):
            raise FileNotFoundError(
                f"Missing Key! Place 'serviceAccountKey.json' in {BASE_DIR}"
            )
        cred = credentials.Certificate(JSON_KEY_PATH)
        firebase_admin.initialize_app(cred)
    import logging
    logging.getLogger("firebase").info("Firebase Admin SDK Initialized")


def get_firestore_client():
    """Returns a Firestore client instance."""
    return firestore.client()


async def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """
    FastAPI dependency — verifies the Firebase ID token from the
    Authorization: Bearer <token> header.
    Returns the decoded token dict (contains uid, phone_number, etc.)
    """
    token = credentials.credentials
    try:
        decoded = auth.verify_id_token(token)
        return decoded
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired. Please login again.")
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")
    except Exception as e:
        # Log the actual error server-side but return generic message to client
        import logging
        logging.getLogger("auth").error(f"Token verification failed: {e}", exc_info=True)
        raise HTTPException(status_code=401, detail="Authentication failed.")
