from pydantic import BaseModel, field_validator, Field
from typing import Optional, Literal


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]  # Restrict to valid roles only
    content: str = Field(..., max_length=5000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default=[], max_length=50)

    @field_validator("message")
    @classmethod
    def strip_message(cls, v: str) -> str:
        return v.strip()


class ChatResponse(BaseModel):
    reply: str
    tool_used: Optional[str] = None
    data_synced: bool = False
    requires_mcp_auth: bool = False
    auth_url: Optional[str] = None


class OnboardRequest(BaseModel):
    goals: list[str] = Field(default=[], max_length=20)

    @field_validator("goals")
    @classmethod
    def validate_goals(cls, v: list[str]) -> list[str]:
        return [g.strip()[:200] for g in v if g.strip()]


class UserProfileResponse(BaseModel):
    uid: str
    phone: Optional[str] = None
    goals: list[str] = []
    status: Optional[str] = None
