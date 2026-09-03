from urllib.parse import urlparse

from app.db.session import _build_connect_args


def test_local_db_no_ssl():
    assert _build_connect_args("postgresql+asyncpg://user:pass@localhost/scholarai") == {}


def test_remote_db_requires_ssl():
    args = _build_connect_args("postgresql+asyncpg://user:pass@db.example.com:5432/postgres")
    assert args["ssl"] == "require"
    assert "statement_cache_size" not in args


def test_pgbouncer_pooler_disables_prepared_statements():
    args = _build_connect_args("postgresql+asyncpg://user:pass@db.example.com:6543/postgres")
    assert args["ssl"] == "require"
    assert args["statement_cache_size"] == 0
    assert args["prepared_statement_cache_size"] == 0
