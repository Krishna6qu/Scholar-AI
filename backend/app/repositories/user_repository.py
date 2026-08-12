import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.identity import Role, User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_role_by_name(self, name: str) -> Role | None:
        result = await self.db.execute(select(Role).where(Role.name == name))
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update_profile(self, user: User, data: dict) -> User:
        for key, value in data.items():
            if value is not None:
                setattr(user, key, value)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def set_password(self, user: User, password_hash: str) -> None:
        user.password_hash = password_hash
        await self.db.commit()

    async def hard_delete(self, user: User) -> None:
        """Permanently removes the user row. Every table that owns user data
        (chats, files, quizzes, flashcards, notes, mind maps, roadmaps,
        settings, notifications, refresh sessions) has ondelete=CASCADE back
        to users.id, so Postgres cascades the deletion all the way down —
        chat_messages, document_chunks, quiz_questions/options/attempts/
        answers, flashcard_items, all go with it automatically."""
        await self.db.delete(user)
        await self.db.commit()
