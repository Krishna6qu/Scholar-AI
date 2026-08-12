"""
Run once, after migrations, before the first registration:
    python -m scripts.seed_roles

Creates the three roles referenced throughout the schema (Student/Admin/Super
Admin). Registration defaults new users to "Student" and will fail with a
clear error if this hasn't been run yet.
"""
import asyncio

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.identity import Role

DEFAULT_ROLES = [
    ("Student", "Default role for new signups — manages own chats, files, quizzes, etc."),
    ("Admin", "Manages users, views analytics, moderates content, accesses audit logs."),
    ("Super Admin", "Full platform access — manages roles/permissions, AI models, system maintenance."),
]


async def seed_roles() -> None:
    async with AsyncSessionLocal() as db:
        for name, description in DEFAULT_ROLES:
            existing = await db.execute(select(Role).where(Role.name == name))
            if existing.scalar_one_or_none() is not None:
                print(f"  - '{name}' already exists, skipping")
                continue
            db.add(Role(name=name, description=description))
            print(f"  - created '{name}'")
        await db.commit()


if __name__ == "__main__":
    print("Seeding default roles...")
    asyncio.run(seed_roles())
    print("Done.")
