from pydantic import BaseModel, ConfigDict, Field


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


class SettingsUpdate(BaseModel):
    theme: str | None = None
    response_length: str | None = None
    temperature: float | None = None
    language: str | None = None
    notifications_enabled: bool | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str
