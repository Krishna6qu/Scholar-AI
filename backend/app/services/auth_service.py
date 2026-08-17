import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from email_validator import EmailNotValidError, validate_email
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    OTP_EXPIRE_MINUTES,
    OTP_MAX_ATTEMPTS,
    TokenType,
    create_token,
    decode_token,
    generate_otp_code,
    hash_otp,
    hash_password,
    verify_otp,
    verify_password,
)
from app.models.identity import PendingRegistration, User
from app.repositories.pending_registration_repository import PendingRegistrationRepository
from app.repositories.refresh_session_repository import RefreshSessionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services.email_service import send_otp_email


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.users = UserRepository(db)
        self.sessions = RefreshSessionRepository(db)
        self.pending = PendingRegistrationRepository(db)

    async def register(self, data: RegisterRequest) -> str:
        """Step 1 of signup: stash the submitted details as a pending
        registration and email a 6-digit code. No `users` row is created
        yet — that only happens once the code is verified."""
        # Reject addresses whose domain has no mail servers at all (typos,
        # made-up domains like "example.com") before we even try to send —
        # this is a DNS MX lookup, not a full "does this inbox exist" check,
        # but it's the strongest signal available without sending mail.
        try:
            validated = await asyncio.to_thread(validate_email, data.email, check_deliverability=True)
        except EmailNotValidError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid email address: {exc}")
        data.email = validated.normalized

        if await self.users.get_by_email(data.email):
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")

        code = generate_otp_code()
        pending = PendingRegistration(
            email=data.email,
            full_name=data.full_name,
            username=data.username,
            password_hash=hash_password(data.password),
            otp_code_hash=hash_otp(code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES),
        )
        await self.pending.upsert(pending)
        await send_otp_email(data.email, code)

        return data.email

    async def resend_otp(self, email: str) -> None:
        pending = await self.pending.get_by_email(email)
        if pending is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "No pending registration found for this email."
            )

        code = generate_otp_code()
        pending.otp_code_hash = hash_otp(code)
        pending.attempts = 0
        pending.expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)
        await self.pending.upsert(pending)
        await send_otp_email(email, code)

    async def verify_otp(self, email: str, code: str) -> TokenResponse:
        """Step 2 of signup: check the code and, if it matches, actually
        create the `users` row — this is the moment the account exists."""
        pending = await self.pending.get_by_email(email)
        if pending is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, "No pending registration found for this email."
            )

        now = datetime.now(timezone.utc)
        expires_at = pending.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now > expires_at:
            await self.pending.delete(pending)
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "This code has expired. Please register again."
            )

        if pending.attempts >= OTP_MAX_ATTEMPTS:
            await self.pending.delete(pending)
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Too many incorrect attempts. Please register again.",
            )

        if not verify_otp(code, pending.otp_code_hash):
            await self.pending.increment_attempts(pending)
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Incorrect verification code.")

        # Guard against a duplicate account being created if the same code
        # somehow gets verified twice concurrently (e.g. a double-submit).
        if await self.users.get_by_email(pending.email):
            await self.pending.delete(pending)
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")

        # Every user needs a role_id — default new signups to "Student".
        # Seeded by scripts/seed_roles.py, which must be run once after migrations.
        student_role = await self.users.get_role_by_name("Student")
        if student_role is None:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "Default role 'Student' not found — run scripts/seed_roles.py first.",
            )

        user = User(
            full_name=pending.full_name,
            email=pending.email,
            username=pending.username,
            password_hash=pending.password_hash,
            role_id=student_role.id,
            is_verified=True,
        )
        user = await self.users.create(user)
        await self.pending.delete(pending)

        return await self._issue_tokens(user.id)

    async def login(self, data: LoginRequest) -> TokenResponse:
        user = await self.users.get_by_email(data.email)
        if user is None or not verify_password(data.password, user.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
        if not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")

        return await self._issue_tokens(user.id)

    async def refresh(self, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if payload is None or payload.get("type") != TokenType.refresh.value:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token.")

        session = await self.sessions.get_active_by_token(refresh_token)
        if session is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token has been revoked or expired.")

        # Rotate: revoke the old session, issue a fresh pair. Prevents replay
        # of a stolen refresh token once it's been used once legitimately.
        await self.sessions.revoke(session)
        return await self._issue_tokens(session.user_id)

    async def logout(self, refresh_token: str) -> None:
        session = await self.sessions.get_active_by_token(refresh_token)
        if session:
            await self.sessions.revoke(session)

    async def _issue_tokens(self, user_id: uuid.UUID) -> TokenResponse:
        access_token = create_token(user_id, TokenType.access)
        refresh_token = create_token(user_id, TokenType.refresh)
        await self.sessions.create(user_id, refresh_token)
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)
