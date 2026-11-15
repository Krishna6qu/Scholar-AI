from datetime import date, timedelta

from app.services.stats_service import compute_day_streak


def test_compute_day_streak_empty():
    today = date(2026, 9, 4)
    assert compute_day_streak([], today) == 0


def test_compute_day_streak_today_only():
    today = date(2026, 9, 4)
    assert compute_day_streak([today], today) == 1


def test_compute_day_streak_consecutive_with_today():
    today = date(2026, 9, 4)
    dates = [
        today,
        today - timedelta(days=1),
        today - timedelta(days=2),
    ]
    assert compute_day_streak(dates, today) == 3


def test_compute_day_streak_yesterday_only():
    today = date(2026, 9, 4)
    dates = [
        today - timedelta(days=1),
        today - timedelta(days=2),
    ]
    assert compute_day_streak(dates, today) == 2


def test_compute_day_streak_broken_streak():
    today = date(2026, 9, 4)
    dates = [today - timedelta(days=2)]  # No activity today or yesterday
    assert compute_day_streak(dates, today) == 0


def test_compute_day_streak_duplicates_and_gap():
    today = date(2026, 9, 4)
    dates = [
        today,
        today,
        today - timedelta(days=1),
        today - timedelta(days=5),  # Gap between day 1 and day 5
    ]
    assert compute_day_streak(dates, today) == 2
