"""Daily generation limits per feature, per user. Resets at UTC midnight —
not the user's local midnight, since we don't have per-user timezone wired
into these queries yet. Simple, predictable trade-off for now."""

DAILY_LIMITS = {
    "quiz": 6,
    "flashcards": 6,
    "mindmap": 6,
    "roadmap": 6,
    "note": 6,
}

FLASHCARD_MAX_COUNT = 25
