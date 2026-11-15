import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.limits import DAILY_LIMITS
from app.core.rate_limit import limiter
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.identity import User
from app.models.misc import AuditLog
from app.repositories.flashcard_repository import FlashcardRepository
from app.repositories.mindmap_repository import MindMapRepository
from app.repositories.note_repository import NoteRepository
from app.repositories.quiz_repository import QuizRepository
from app.repositories.refresh_session_repository import RefreshSessionRepository
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
    AuditLogItemResponse,
    DeleteAccountRequest,
    LearningStatsResponse,
    PasswordChangeRequest,
    ProfileUpdate,
    SessionItemResponse,
    SettingsResponse,
    SettingsUpdate,
)
from app.services.auth_service import AuthService
from app.services.stats_service import StatsService

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("15/hour")
async def register(request: Request, data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Simple signup: validates email & password, creates the account immediately,
    and returns auth tokens so the user is instantly logged in."""
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return await AuthService(db).register(data, ip_address=ip, user_agent=ua)


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
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return await AuthService(db).login(data, ip_address=ip, user_agent=ua)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh(request: Request, data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return await AuthService(db).refresh(data.refresh_token, ip_address=ip, user_agent=ua)


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
@limiter.limit("5/15minute")
async def change_password(
    request: Request,
    data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Current password is incorrect.")
    await UserRepository(db).set_password(current_user, hash_password(data.new_password))

    # Defensive Security: Revoke all refresh sessions so stolen tokens lose access immediately
    await RefreshSessionRepository(db).revoke_all_for_user(current_user.id)

    # Record security audit log
    client_ip = request.client.host if request.client else None
    audit = AuditLog(
        user_id=current_user.id,
        action="PASSWORD_CHANGED",
        entity_type="user",
        entity_id=current_user.id,
        ip_address=client_ip,
        log_metadata={"timestamp": datetime.now(timezone.utc).isoformat()},
    )
    db.add(audit)
    await db.commit()


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
    note_used = await NoteRepository(db).count_today(current_user.id)

    reached: list[str] = []
    if quiz_used >= DAILY_LIMITS["quiz"]:
        reached.append("quiz")
    if flashcards_used >= DAILY_LIMITS["flashcards"]:
        reached.append("flashcards")
    if mindmap_used >= DAILY_LIMITS["mindmap"]:
        reached.append("mindmap")
    if roadmap_used >= DAILY_LIMITS["roadmap"]:
        reached.append("roadmap")
    if note_used >= DAILY_LIMITS["note"]:
        reached.append("note")

    return UsageResponse(
        quiz=FeatureUsage(used=quiz_used, limit=DAILY_LIMITS["quiz"]),
        flashcards=FeatureUsage(used=flashcards_used, limit=DAILY_LIMITS["flashcards"]),
        mindmap=FeatureUsage(used=mindmap_used, limit=DAILY_LIMITS["mindmap"]),
        roadmap=FeatureUsage(used=roadmap_used, limit=DAILY_LIMITS["roadmap"]),
        note=FeatureUsage(used=note_used, limit=DAILY_LIMITS["note"]),
        resets_in_hours=5,
        any_limit_reached=len(reached) > 0,
        limit_reached_features=reached,
    )


@router.get("/me/stats", response_model=LearningStatsResponse)
async def get_learning_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_tz = current_user.timezone or "UTC"
    return await StatsService(db).get_learning_stats(current_user.id, user_tz)


def _format_export_markdown(data: dict) -> str:
    profile = data.get("profile", {})
    lines = [
        "# ScholarAI Export Report",
        f"**Exported At**: {data.get('exported_at')}",
        f"**User**: {profile.get('full_name')} ({profile.get('email')})",
        f"**College**: {profile.get('college') or 'N/A'} | **Course**: {profile.get('course') or 'N/A'}",
        "\n---\n",
        "## Summary of Data",
        f"- Chats: {len(data.get('chats', []))}",
        f"- Short Notes: {len(data.get('notes', []))}",
        f"- Flashcard Sets: {len(data.get('flashcard_sets', []))}",
        f"- Quizzes: {len(data.get('quizzes', []))}",
        f"- Mind Maps: {len(data.get('mind_maps', []))}",
        f"- Roadmaps: {len(data.get('roadmaps', []))}",
        "\n---\n",
        "## Study Chats\n",
    ]
    for chat in data.get("chats", []):
        lines.append(f"### {chat.get('title', 'Untitled Chat')}")
        lines.append(f"*Created: {chat.get('created_at')}*\n")
        for m in chat.get("messages", []):
            sender = "ScholarAI" if m.get("sender") == "assistant" else "You"
            lines.append(f"**{sender}**: {m.get('content')}\n")

    lines.append("\n## Revision Notes\n")
    for note in data.get("notes", []):
        lines.append(f"### {note.get('title')}")
        tags_str = ", ".join(note.get("tags", [])) if note.get("tags") else "None"
        lines.append(f"**Tags**: {tags_str}\n")
        lines.append(f"{note.get('content')}\n")

    lines.append("\n## Flashcard Sets\n")
    for fset in data.get("flashcard_sets", []):
        lines.append(f"### {fset.get('title')} ({fset.get('card_count', 0)} cards)")
        for card in fset.get("cards", []):
            lines.append(f"- **Q**: {card.get('question')}\n  **A**: {card.get('answer')}")

    lines.append("\n## Quizzes\n")
    for q in data.get("quizzes", []):
        lines.append(f"### {q.get('title')} ({q.get('difficulty')})")
        for quest in q.get("questions", []):
            lines.append(f"- **Question**: {quest.get('question_text')}")
            for opt in quest.get("options", []):
                chk = "[x]" if opt.get("is_correct") else "[ ]"
                lines.append(f"  - {chk} {opt.get('text')}")
            if quest.get("explanation"):
                lines.append(f"  *Explanation*: {quest.get('explanation')}")

    return "\n".join(lines)


@router.get("/me/export")
@limiter.limit("5/hour")
async def export_my_data(
    request: Request,
    format: str = Query("json", pattern="^(json|markdown)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    export_dict = await StatsService(db).export_user_data(current_user)

    client_ip = request.client.host if request.client else None
    audit = AuditLog(
        user_id=current_user.id,
        action="DATA_EXPORTED",
        entity_type="user",
        entity_id=current_user.id,
        ip_address=client_ip,
        log_metadata={"format": format, "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    db.add(audit)
    await db.commit()

    if format == "markdown":
        md_text = _format_export_markdown(export_dict)
        return Response(
            content=md_text,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="scholarai-export-{datetime.now(timezone.utc).strftime("%Y-%m-%d")}.md"'
            },
        )

    return export_dict


@router.get("/me/sessions", response_model=list[SessionItemResponse])
async def list_my_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sessions = await RefreshSessionRepository(db).list_active_for_user(current_user.id)
    return [
        SessionItemResponse(
            id=s.id,
            device_name=s.device_name or "Unknown Device",
            browser=s.browser or "Web Browser",
            ip_address=s.ip_address or "Unknown IP",
            created_at=s.created_at,
            expires_at=s.expires_at,
            is_current=(idx == 0),
        )
        for idx, s in enumerate(sessions)
    ]


@router.post("/me/sessions/revoke-others", status_code=status.HTTP_200_OK)
async def revoke_other_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = RefreshSessionRepository(db)
    active_sessions = await repo.list_active_for_user(current_user.id)
    count = 0
    if len(active_sessions) > 1:
        for s in active_sessions[1:]:
            await repo.revoke_by_id(current_user.id, s.id)
            count += 1

    client_ip = request.client.host if request.client else None
    audit = AuditLog(
        user_id=current_user.id,
        action="SESSIONS_REVOKED_OTHERS",
        entity_type="user",
        entity_id=current_user.id,
        ip_address=client_ip,
        log_metadata={"revoked_count": count, "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    db.add(audit)
    await db.commit()
    return {"revoked": count, "message": f"Successfully revoked {count} other session(s)."}


@router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session_by_id(
    session_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = RefreshSessionRepository(db)
    revoked = await repo.revoke_by_id(current_user.id, session_id)
    if not revoked:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found or already revoked.")

    client_ip = request.client.host if request.client else None
    audit = AuditLog(
        user_id=current_user.id,
        action="SESSION_REVOKED",
        entity_type="session",
        entity_id=session_id,
        ip_address=client_ip,
        log_metadata={"session_id": str(session_id), "timestamp": datetime.now(timezone.utc).isoformat()},
    )
    db.add(audit)
    await db.commit()


@router.get("/me/audit-logs", response_model=list[AuditLogItemResponse])
async def get_my_audit_logs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(50)
    )
    logs = list(result.scalars().all())
    return [
        AuditLogItemResponse(
            id=log.id,
            action=log.action,
            entity_type=log.entity_type,
            ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    data: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.password, current_user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect password.")
    await UserRepository(db).hard_delete(current_user)
