"""
Password hashing and JWT helpers. Kept dependency-free of FastAPI so it can be
unit tested in isolation (Phase 11).
"""
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt

from app.core.config import settings

_hasher = PasswordHasher()

OTP_LENGTH = 6
OTP_EXPIRE_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


def generate_otp_code() -> str:
    """Cryptographically random numeric code, zero-padded to OTP_LENGTH."""
    return f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"


def hash_otp(code: str) -> str:
    # Reuse the argon2 hasher used for passwords — it's already imported and
    # unit tested, and hashing one 6-digit code per request is cheap.
    return _hasher.hash(code)


def verify_otp(code: str, code_hash: str) -> bool:
    try:
        return _hasher.verify(code_hash, code)
    except VerifyMismatchError:
        return False


class TokenType(str, Enum):
    access = "access"
    refresh = "refresh"


def hash_password(plain_password: str) -> str:
    return _hasher.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, plain_password)
    except VerifyMismatchError:
        return False


def create_token(subject: uuid.UUID, token_type: TokenType) -> str:
    now = datetime.now(timezone.utc)
    if token_type == TokenType.access:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    payload = {
        "sub": str(subject),
        "type": token_type.value,
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
