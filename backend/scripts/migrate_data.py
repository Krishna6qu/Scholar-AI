"""
Cross-platform data migration script for migrating ScholarAI data from Neon to Supabase.

Prerequisites:
  1. Alembic schema must already be applied to the target database:
       alembic upgrade head
  2. Set environment variables:
       $env:SOURCE_DATABASE_URL = "postgresql+asyncpg://user:pass@neon-host/neondb"
       $env:TARGET_DATABASE_URL = "postgresql+asyncpg://postgres:pass@supabase-host:5432/postgres"
     (Use direct connection on port 5432 during migration).
  3. Run:
       python scripts/migrate_data.py
"""
import asyncio
import os
import sys
from urllib.parse import urlparse

from sqlalchemy import MetaData, create_engine, select, text
from sqlalchemy.engine import Engine

# Ordered list of tables to migrate respecting foreign keys
TABLES_ORDER = [
    "roles",
    "permissions",
    "role_permissions",
    "users",
    "pending_registrations",
    "refresh_sessions",
    "user_settings",
    "ai_models",
    "chats",
    "chat_messages",
    "uploaded_files",
    "document_chunks",
    "quizzes",
    "quiz_questions",
    "quiz_options",
    "quiz_attempts",
    "quiz_answers",
    "flashcards",
    "flashcard_items",
    "short_notes",
    "mind_maps",
    "roadmaps",
    "notifications",
    "audit_logs",
]


def _to_sync_url(url: str) -> str:
    """Convert asyncpg URL to standard postgresql URL for batch migration."""
    return url.replace("postgresql+asyncpg://", "postgresql://")


def migrate_data(source_url: str, target_url: str) -> None:
    source_sync = _to_sync_url(source_url)
    target_sync = _to_sync_url(target_url)

    print(f"Connecting to source: {urlparse(source_sync).hostname}...")
    source_engine = create_engine(source_sync)

    print(f"Connecting to target: {urlparse(target_sync).hostname}...")
    target_engine = create_engine(target_sync)

    source_meta = MetaData()
    source_meta.reflect(bind=source_engine)

    target_meta = MetaData()
    target_meta.reflect(bind=target_engine)

    with target_engine.begin() as target_conn:
        for table_name in TABLES_ORDER:
            if table_name not in source_meta.tables:
                print(f"[-] Skipping {table_name}: not in source database")
                continue
            if table_name not in target_meta.tables:
                print(f"[-] Skipping {table_name}: not in target database (run alembic upgrade head first!)")
                continue

            src_table = source_meta.tables[table_name]
            tgt_table = target_meta.tables[table_name]

            with source_engine.connect() as src_conn:
                rows = src_conn.execute(select(src_table)).mappings().all()

            if not rows:
                print(f"[0] {table_name}: 0 rows to migrate")
                continue

            target_count = target_conn.execute(select(text(f"COUNT(*) FROM {table_name}"))).scalar()
            if target_count and target_count > 0:
                print(f"[!] Warning: {table_name} already contains {target_count} rows in target. Skipping.")
                continue

            batch = [dict(row) for row in rows]
            target_conn.execute(tgt_table.insert(), batch)
            print(f"[+] Migrated {len(batch)} rows into {table_name}")

    print("\nData migration completed successfully! Please verify row counts.")


def main():
    source = os.environ.get("SOURCE_DATABASE_URL") or os.environ.get("NEON_DATABASE_URL")
    target = os.environ.get("TARGET_DATABASE_URL") or os.environ.get("SUPABASE_DATABASE_URL")

    if not source or not target:
        print(
            "Error: SOURCE_DATABASE_URL (or NEON_DATABASE_URL) and "
            "TARGET_DATABASE_URL (or SUPABASE_DATABASE_URL) must be set in environment.",
            file=sys.stderr,
        )
        sys.exit(1)

    migrate_data(source, target)


if __name__ == "__main__":
    main()
