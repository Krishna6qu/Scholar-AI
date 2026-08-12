# ScholarAI

**Your Intelligent AI Learning Companion** — a full-stack AI-powered study platform built for students.

ScholarAI combines an AI chat workspace, a fully configurable quiz generator, auto-generated flashcards and revision notes, interactive mind maps, and a career roadmap generator — all in one place, with real authentication, per-feature daily usage limits, and a premium dark/neon interface.

---

## ✨ Features

- **AI Chat** — start a conversation on any topic, no setup required. Attach a file (`.txt`, `.md`, `.csv`, `.pdf`) and ScholarAI reads it and answers grounded in your material. Markdown-rendered responses with copy and like/dislike feedback on every reply.
- **Custom Quizzes** — pick the topic, question type (MCQ, short answer, true/false, or a mix), difficulty (easy → interview-level), time limit, and whether you want hints. AI-generated, auto-graded, with a review screen showing correct answers.
- **Flashcards** — describe a topic, get a flip-card set generated in seconds.
- **Revision Notes** — dense, markdown-formatted notes for quick review, generated on demand.
- **Interactive Mind Maps** — a visual, clickable tree diagram of a topic's key concepts; click any node to read more about it.
- **Career Roadmaps** — describe what you want to become, get a detailed multi-phase, step-by-step plan with resources — exportable as a PDF.
- **Auth & Accounts** — JWT access/refresh tokens, Argon2 password hashing, email verification, profile & settings management, and permanent account deletion.
- **Daily usage limits** per feature (quizzes, flashcards, mind maps, roadmaps) to keep AI costs predictable.

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python), SQLAlchemy 2.0 (async), Alembic |
| Database | PostgreSQL ([Neon](https://neon.tech)) |
| AI | [LiteLLM](https://github.com/BerriAI/litellm) — provider-agnostic (OpenAI, Anthropic, Gemini) |
| Auth | JWT (access + refresh), Argon2 password hashing |
| Frontend | React + TypeScript + Vite, Tailwind CSS, React Router |
| File storage | Local disk (dev) or any S3-compatible provider (R2 / Backblaze B2 / AWS S3) in production |
| Email | [Resend](https://resend.com) |
| Rate limiting | slowapi (Redis-backed in production) |
| Deployment | Render (backend), Vercel (frontend) |

## 📁 Project Structure

```
scholarai/
├── backend/
│   ├── app/
│   │   ├── api/v1/        # Route handlers
│   │   ├── core/          # Config, security, rate limiting, storage
│   │   ├── models/        # SQLAlchemy models
│   │   ├── repositories/  # Database query layer
│   │   ├── schemas/       # Pydantic request/response models
│   │   └── services/      # Business logic (incl. AI generation)
│   ├── alembic/           # Database migrations
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── pages/          # Route-level page components
    │   ├── components/     # Shared components
    │   ├── store/           # Zustand auth store
    │   └── lib/              # API client
    └── package.json
```

## 🚀 Local Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env         # then fill in your values — see below
alembic upgrade head
python -m scripts.seed_roles
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Visit `http://localhost:5173`.

## 🔑 Environment Variables

See `backend/.env.example` for the full list with inline explanations. At minimum you need:

- `SECRET_KEY` — for JWT signing
- `DATABASE_URL` — a PostgreSQL connection string (e.g. from [Neon](https://neon.tech))
- One AI provider key: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` + matching `DEFAULT_AI_MODEL`

Optional for production: `REDIS_URL` (rate limiting), `RESEND_API_KEY` (email), S3-compatible storage credentials (`S3_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `USE_S3_STORAGE=true`).

## 📦 Deployment

- **Backend** → [Render](https://render.com) (`render.yaml` included — Blueprint deploy)
- **Frontend** → [Vercel](https://vercel.com) (`vercel.json` included for SPA routing)
- **Database** → [Neon](https://neon.tech) (free Postgres)
- **Redis** → [Upstash](https://upstash.com) (free tier)
- **File storage** → [Backblaze B2](https://backblaze.com) or [Cloudflare R2](https://cloudflare.com) (S3-compatible)
- **Email** → [Resend](https://resend.com)

## 📄 License

This project is for educational/portfolio purposes.
