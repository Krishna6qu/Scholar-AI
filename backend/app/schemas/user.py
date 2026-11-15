import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    username: str | None = Field(default=None, max_length=50)
    bio: str | None = None
    college: str | None = Field(default=None, max_length=150)
    course: str | None = Field(default=None, max_length=100)
    semester: int | None = None


class SettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    theme: str
    response_length: str
    temperature: float
    language: str
    notifications_enabled: bool
    study_mode: str = "balanced"
    default_quiz_difficulty: str = "medium"
    default_flashcard_count: int = 10
    audio_speed: float = 1.0
    audio_voice: str = "system"
    data_retention_days: int = 0
    telemetry_opt_out: bool = False


class SettingsUpdate(BaseModel):
    theme: str | None = None
    response_length: str | None = None
    temperature: float | None = None
    language: str | None = None
    notifications_enabled: bool | None = None
    study_mode: str | None = None
    default_quiz_difficulty: str | None = None
    default_flashcard_count: int | None = None
    audio_speed: float | None = None
    audio_voice: str | None = None
    data_retention_days: int | None = None
    telemetry_opt_out: bool | None = None


class SessionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    device_name: str | None = None
    browser: str | None = None
    ip_address: str | None = None
    created_at: datetime
    expires_at: datetime
    is_current: bool = False


class AuditLogItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action: str
    entity_type: str | None = None
    ip_address: str | None = None
    created_at: datetime


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not any(c.isupper() for c in v) or not any(c.islower() for c in v):
            raise ValueError("Password must contain both uppercase and lowercase letters.")
        if not any(c.isdigit() or not c.isalnum() for c in v):
            raise ValueError("Password must contain at least one digit or special character.")
        return v


class DeleteAccountRequest(BaseModel):
    password: str


class LearningStatsResponse(BaseModel):
    total_chats: int
    total_quizzes: int
    day_streak: int


