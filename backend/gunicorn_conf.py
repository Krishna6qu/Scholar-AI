"""
Production server config. Run with:
    gunicorn app.main:app -c gunicorn_conf.py

This replaces `uvicorn app.main:app --reload` for production — --reload is a
DEV-ONLY flag (it re-imports your code on every file change, which is slow
and unsafe under real load). Gunicorn manages multiple Uvicorn worker
processes instead, so requests are actually handled concurrently across CPU
cores rather than by a single process.
"""
import multiprocessing
import os

bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
worker_class = "uvicorn.workers.UvicornWorker"

# A common starting formula: 2x CPU cores + 1. Tune based on real load
# testing — AI-call-heavy endpoints are I/O-bound (waiting on the LLM
# provider), so you can typically run more workers than CPU-bound workloads
# would suggest.
workers = int(os.getenv("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))

timeout = 60  # AI generation calls can legitimately take 10-30s
graceful_timeout = 30
keepalive = 5

accesslog = "-"  # stdout
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")
