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
# Default to 2 workers to fit comfortably within Render's free/starter 512MB RAM tier
# while allowing concurrent request processing. Can be overridden via WEB_CONCURRENCY.
workers = int(os.getenv("WEB_CONCURRENCY", "2"))

# Worker recycling: restart workers after handling requests to prevent memory fragmentation
# and leaks under prolonged high-concurrency traffic
max_requests = 1000
max_requests_jitter = 100

timeout = 120  # AI generation calls (quizzes, notes, roadmaps) can take 15-45s under load
graceful_timeout = 30
keepalive = 10  # Reuse TCP connections for high-throughput clients

accesslog = "-"  # stdout
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")
