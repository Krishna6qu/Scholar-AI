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


def _parse_device_info(ua_string: str | None) -> tuple[str, str]:
    if not ua_string:
        return ("Desktop Device", "Web Browser")
    ua = ua_string.lower()
    browser = "Chrome" if "chrome" in ua else "Firefox" if "firefox" in ua else "Safari" if "safari" in ua else "Edge" if "edg" in ua else "Web Browser"
    device = "Mobile Phone" if "mobile" in ua else "Tablet" if "tablet" in ua or "ipad" in ua else "Mac / PC"
    return (device, browser)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.users = UserRepository(db)
        self.sessions = RefreshSessionRepository(db)
        self.pending = PendingRegistrationRepository(db)

    async def register(
        self, data: RegisterRequest, ip_address: str | None = None, user_agent: str | None = None
    ) -> TokenResponse:
        """Simple signup: validates details and creates the user account directly
        without requiring email OTP verification. Immediately issues authentication tokens."""
        email = str(data.email).strip().lower()

        if await self.users.get_by_email(email):
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")

        student_role = await self.users.get_role_by_name("Student")
        if student_role is None:
            roles = await self.users.list_roles()
            role_id = roles[0].id if roles else None
            if role_id is None:
                raise HTTPException(
                    status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "Default role 'Student' not found — please run seed script.",
                )
        else:
            role_id = student_role.id

        display_name = (data.full_name or "").strip() or email.split("@")[0].capitalize()

        user = User(
            full_name=display_name,
            email=email,
            username=data.username,
            password_hash=hash_password(data.password),
            role_id=role_id,
            is_verified=True,
            is_active=True,
        )
        user = await self.users.create(user)

        device, browser = _parse_device_info(user_agent)
        return await self._issue_tokens(
            user.id, ip_address=ip_address, user_agent=user_agent, device_name=device, browser=browser
        )

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

    async def login(
        self, data: LoginRequest, ip_address: str | None = None, user_agent: str | None = None
    ) -> TokenResponse:
        user = await self.users.get_by_email(data.email)
        if user is None or not verify_password(data.password, user.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
        if not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")

        device, browser = _parse_device_info(user_agent)
        return await self._issue_tokens(
            user.id, ip_address=ip_address, user_agent=user_agent, device_name=device, browser=browser
        )

    async def refresh(
        self, refresh_token: str, ip_address: str | None = None, user_agent: str | None = None
    ) -> TokenResponse:
        payload = decode_token(refresh_token)
        if payload is None or payload.get("type") != TokenType.refresh.value:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token.")

        session = await self.sessions.get_active_by_token(refresh_token)
        if session is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token has been revoked or expired.")

        # Rotate: revoke the old session, issue a fresh pair. Prevents replay
        # of a stolen refresh token once it's been used once legitimately.
        await self.sessions.revoke(session)
        device, browser = _parse_device_info(user_agent)
        return await self._issue_tokens(
            session.user_id, ip_address=ip_address, user_agent=user_agent, device_name=device, browser=browser
        )

    async def logout(self, refresh_token: str) -> None:
        session = await self.sessions.get_active_by_token(refresh_token)
        if session:
            await self.sessions.revoke(session)

    async def _issue_tokens(
        self,
        user_id: uuid.UUID,
        ip_address: str | None = None,
        user_agent: str | None = None,
        device_name: str | None = None,
        browser: str | None = None,
    ) -> TokenResponse:
        access_token = create_token(user_id, TokenType.access)
        refresh_token = create_token(user_id, TokenType.refresh)
        await self.sessions.create(
            user_id=user_id,
            refresh_token=refresh_token,
            device_name=device_name,
            browser=browser,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

