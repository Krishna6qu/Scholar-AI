"""
Import every model module here. Alembic's env.py imports this package so
`Base.metadata` is fully populated before autogenerate diffs the schema —
forgetting a model here is the #1 cause of "migration doesn't create my table."
"""
from app.models.identity import (  # noqa: F401
    PendingRegistration,
    Permission,
    RefreshSession,
    Role,
    RolePermission,
    User,
)
from app.models.chat import Chat, ChatMessage  # noqa: F401
from app.models.files import AIModel, DocumentChunk, UploadedFile  # noqa: F401
from app.models.study import (  # noqa: F401
    Flashcard,
    FlashcardItem,
    MindMap,
    Quiz,
    QuizAnswer,
    QuizAttempt,
    QuizOption,
    QuizQuestion,
    ShortNote,
)
from app.models.misc import AuditLog, Notification, UserSettings  # noqa: F401
from app.models.roadmap import Roadmap  # noqa: F401
