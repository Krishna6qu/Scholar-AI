from fastapi import APIRouter

from app.api.v1 import auth, chats, files, flashcards, health, mindmaps, notes, quizzes, roadmaps

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(chats.router, prefix="/chats", tags=["chats"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(quizzes.router, prefix="/quizzes", tags=["quizzes"])
api_router.include_router(flashcards.router, prefix="/flashcards", tags=["flashcards"])
api_router.include_router(notes.router, prefix="/notes", tags=["notes"])
api_router.include_router(mindmaps.router, prefix="/mindmaps", tags=["mindmaps"])
api_router.include_router(roadmaps.router, prefix="/roadmaps", tags=["roadmaps"])
