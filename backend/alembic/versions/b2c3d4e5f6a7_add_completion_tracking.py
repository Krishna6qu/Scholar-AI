"""add completion tracking for flashcards, mind maps, and roadmaps

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-03 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('flashcards', sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        'flashcards',
        sa.Column('times_reviewed', sa.Integer(), nullable=False, server_default='0'),
    )

    op.add_column('mind_maps', sa.Column('viewed_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column(
        'roadmaps',
        sa.Column('step_progress', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
    )


def downgrade() -> None:
    op.drop_column('roadmaps', 'step_progress')
    op.drop_column('mind_maps', 'viewed_at')
    op.drop_column('flashcards', 'times_reviewed')
    op.drop_column('flashcards', 'reviewed_at')
