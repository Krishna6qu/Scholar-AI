"""add pending_registrations for OTP signup

Revision ID: a1b2c3d4e5f6
Revises: e3f0e824bc37
Create Date: 2026-08-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a1b2c3d4e5f6'
down_revision = 'e3f0e824bc37'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'pending_registrations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=120), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=True),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('otp_code_hash', sa.Text(), nullable=False),
        sa.Column('attempts', sa.SmallInteger(), nullable=False, server_default='0'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index(
        op.f('ix_pending_registrations_email'), 'pending_registrations', ['email'], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_pending_registrations_email'), table_name='pending_registrations')
    op.drop_table('pending_registrations')