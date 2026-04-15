from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore
from backend.firebase_config import verify_firebase_token, get_firestore_client
from backend.schemas import OnboardRequest, UserProfileResponse

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/verify")
async def verify_user(token_data: dict = Depends(verify_firebase_token)):
    """
    Verifies the Firebase ID token and returns the user's profile
    from Firestore. If no profile exists yet, returns a minimal response.
    """
    uid = token_data["uid"]
    db = get_firestore_client()

    user_doc = db.collection("users").document(uid).get()

    if user_doc.exists:
        profile = user_doc.to_dict()
        return UserProfileResponse(
            uid=uid,
            phone=profile.get("phone"),
            goals=profile.get("goals", []),
            status=profile.get("status"),
        )
    else:
        # User authenticated but not onboarded yet
        return UserProfileResponse(uid=uid, phone=token_data.get("phone_number"))


@router.post("/onboard")
async def onboard_user(
    req: OnboardRequest,
    token_data: dict = Depends(verify_firebase_token),
):
    """
    Creates or updates the user's profile in Firestore with their
    financial goals. Called after first login.
    """
    uid = token_data["uid"]
    phone = token_data.get("phone_number", "")
    db = get_firestore_client()

    user_ref = db.collection("users").document(uid)
    user_ref.set(
        {
            "phone": phone,
            "goals": req.goals,
            "status": "active",
            "last_login": firestore.SERVER_TIMESTAMP,
            "uid": uid,
        },
        merge=True,
    )

    return {"message": "Onboarding complete", "uid": uid}
