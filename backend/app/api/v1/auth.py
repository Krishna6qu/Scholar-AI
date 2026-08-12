from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.limits import DAILY_LIMITS
from app.core.rate_limit import limiter
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.identity import User
from app.repositories.flashcard_repository import FlashcardRepository
from app.repositories.mindmap_repository import MindMapRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.roadmap_repository import RoadmapRepository
from app.repositories.settings_repository import SettingsRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    ResendOtpRequest,
    TokenResponse,
    UserResponse,
    VerifyOtpRequest,
)
from app.schemas.usage import FeatureUsage, UsageResponse
from app.schemas.user import (
    DeleteAccountRequest,
    PasswordChangeRequest,
    ProfileUpdate,
    SettingsResponse,
    SettingsUpdate,
)
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_200_OK)
@limiter.limit("5/hour")
async def register(request: Request, data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Step 1 of signup: validates the details and emails a 6-digit code.
    The account itself isn't created until /register/verify succeeds."""
    email = await AuthService(db).register(data)
    return RegisterResponse(detail="Verification code sent to your email.", email=email)


@router.post("/register/verify", response_model=TokenResponse)
@limiter.limit("10/hour")
async def verify_registration(request: Request, data: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    """Step 2 of signup: checks the code and, if correct, creates the
    account and logs the user in."""
    return await AuthService(db).verify_otp(data.email, data.code)


@router.post("/register/resend", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/hour")
async def resend_registration_otp(
    request: Request, data: ResendOtpRequest, db: AsyncSession = Depends(get_db)
):
    await AuthService(db).resend_otp(data.email)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService(db).login(data)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh(request: Request, data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await AuthService(db).refresh(data.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    await AuthService(db).logout(data.refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await UserRepository(db).update_profile(current_user, data.model_dump(exclude_unset=True))


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Current password is incorrect.")
    await UserRepository(db).set_password(current_user, hash_password(data.new_password))


@router.get("/me/settings", response_model=SettingsResponse)
async def get_my_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SettingsRepository(db).get_or_create(current_user.id)


@router.patch("/me/settings", response_model=SettingsResponse)
async def update_my_settings(
    data: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = SettingsRepository(db)
    row = await repo.get_or_create(current_user.id)
    return await repo.update(row, data.model_dump(exclude_unset=True))


@router.get("/me/usage", response_model=UsageResponse)
async def get_my_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    quiz_used = await QuizRepository(db).count_today(current_user.id)
    flashcards_used = await FlashcardRepository(db).count_today(current_user.id)
    mindmap_used = await MindMapRepository(db).count_today(current_user.id)
    roadmap_used = await RoadmapRepository(db).count_today(current_user.id)

    return UsageResponse(
        quiz=FeatureUsage(used=quiz_used, limit=DAILY_LIMITS["quiz"]),
        flashcards=FeatureUsage(used=flashcards_used, limit=DAILY_LIMITS["flashcards"]),
        mindmap=FeatureUsage(used=mindmap_used, limit=DAILY_LIMITS["mindmap"]),
        roadmap=FeatureUsage(used=roadmap_used, limit=DAILY_LIMITS["roadmap"]),
    )


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    data: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.password, current_user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect password.")
    await UserRepository(db).hard_delete(current_user)
