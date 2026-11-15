import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.network_security import validate_safe_url
from app.schemas.user import PasswordChangeRequest, SettingsResponse, SettingsUpdate
from app.services.file_service import ALLOWED_FILE_EXTENSIONS, DISALLOWED_EXTENSIONS, sanitize_filename


def test_ssrf_protection_blocks_loopback_and_private_ips():
    """Verify SSRF engine blocks localhost, loopback, private RFC 1918, and AWS metadata IPs."""
    # Loopback
    with pytest.raises(HTTPException) as exc_info:
        validate_safe_url("http://127.0.0.1:8000/admin")
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        validate_safe_url("http://localhost:8000")
    assert exc_info.value.status_code == 400

    # AWS/GCP/Azure Cloud Metadata IP
    with pytest.raises(HTTPException) as exc_info:
        validate_safe_url("http://169.254.169.254/latest/meta-data/")
    assert exc_info.value.status_code == 400

    # RFC 1918 Private networks
    with pytest.raises(HTTPException) as exc_info:
        validate_safe_url("http://10.0.0.1/internal")
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        validate_safe_url("http://192.168.1.1/")
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        validate_safe_url("http://172.16.0.1/")
    assert exc_info.value.status_code == 400


def test_ssrf_protection_blocks_unsupported_schemes():
    """Verify non-HTTP(S) schemes like file://, ftp://, gopher:// are rejected."""
    with pytest.raises(HTTPException) as exc_info:
        validate_safe_url("file:///etc/passwd")
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        validate_safe_url("ftp://example.com/data.txt")
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info:
        validate_safe_url("gopher://example.com")
    assert exc_info.value.status_code == 400


def test_ssrf_protection_allows_valid_public_urls(monkeypatch):
    """Verify public URLs pass validation without exceptions."""
    import socket
    # Mock DNS resolution so unit tests do not depend on external network connectivity
    def mock_getaddrinfo(host, port, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('142.250.190.46', port or 443))]

    monkeypatch.setattr(socket, "getaddrinfo", mock_getaddrinfo)
    # Should not raise any exception
    validate_safe_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    validate_safe_url("https://en.wikipedia.org/wiki/Artificial_intelligence")


def test_rate_limiter_unreachable_redis_fallback():
    """Verify that an unreachable Redis URL (e.g. expired Upstash or DNS failure)
    automatically and cleanly falls back to in-memory rate limiting ('memory://')
    instead of crashing login and ASGI requests."""
    from app.core.rate_limit import _resolve_storage_uri

    # Test dead Upstash cluster / unresolvable host
    res = _resolve_storage_uri("redis://romantic-midge-163936.upstash.io:6379")
    assert res == "memory://"

    # Test invalid scheme (e.g. copying Upstash REST https:// instead of rediss://)
    res_https = _resolve_storage_uri("https://romantic-midge-163936.upstash.io")
    assert res_https == "memory://"

    # Test empty / default
    assert _resolve_storage_uri("") == "memory://"
    assert _resolve_storage_uri("redis://localhost:6379/0") == "memory://"


def test_file_upload_security_rules():
    """Verify file upload extension restrictions and dangerous script mitigations."""
    # Dangerous extensions must be explicitly disallowed
    dangerous_exts = [".html", ".htm", ".svg", ".exe", ".bat", ".cmd", ".sh", ".php", ".js"]
    for ext in dangerous_exts:
        assert ext in DISALLOWED_EXTENSIONS

    # Safe educational document formats must be allowed
    safe_exts = [".pdf", ".txt", ".md", ".csv", ".docx", ".pptx", ".xlsx", ".png", ".jpg", ".jpeg", ".webp"]
    for ext in safe_exts:
        assert ext in ALLOWED_FILE_EXTENSIONS

    # Verify filename sanitization against path traversal
    sanitized = sanitize_filename("../../../etc/passwd.pdf")
    assert ".." not in sanitized
    assert "/" not in sanitized
    assert "\\" not in sanitized
    assert sanitized.endswith(".pdf")


def test_password_complexity_policy():
    """Verify strict password complexity checks in PasswordChangeRequest."""
    # Too short (< 8 chars)
    with pytest.raises(ValidationError):
        PasswordChangeRequest(current_password="OldPassword123!", new_password="Ab1!")

    # No uppercase
    with pytest.raises(ValidationError):
        PasswordChangeRequest(current_password="OldPassword123!", new_password="password123!")

    # No lowercase
    with pytest.raises(ValidationError):
        PasswordChangeRequest(current_password="OldPassword123!", new_password="PASSWORD123!")

    # No digit or symbol
    with pytest.raises(ValidationError):
        PasswordChangeRequest(current_password="OldPassword123!", new_password="PasswordOnly")

    # Fully compliant password
    req = PasswordChangeRequest(current_password="OldPassword123!", new_password="ScholarAI#2026!")
    assert req.new_password == "ScholarAI#2026!"


def test_settings_schema_advanced_fields():
    """Verify SettingsResponse and SettingsUpdate support new study intelligence & privacy fields."""
    update = SettingsUpdate(
        study_mode="step_by_step",
        default_quiz_difficulty="hard",
        default_flashcard_count=15,
        audio_speed=1.25,
        audio_voice="mentor",
        data_retention_days=90,
        telemetry_opt_out=True,
    )
    dump = update.model_dump(exclude_unset=True)
    assert dump["study_mode"] == "step_by_step"
    assert dump["default_quiz_difficulty"] == "hard"
    assert dump["default_flashcard_count"] == 15
    assert dump["audio_speed"] == 1.25
    assert dump["audio_voice"] == "mentor"
    assert dump["data_retention_days"] == 90
    assert dump["telemetry_opt_out"] is True
