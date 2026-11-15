import pytest
from app.services.source_service import SourceService, YOUTUBE_RE, AUDIO_SCRIPT_RE


def test_youtube_regex_matching():
    urls = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://youtube.com/shorts/dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
        "http://www.youtube.com/embed/dQw4w9WgXcQ",
    ]
    for u in urls:
        m = YOUTUBE_RE.search(u)
        assert m is not None, f"Failed to match {u}"
        assert m.group(1) == "dQw4w9WgXcQ"


def test_audio_script_regex_extraction():
    sample_text = """
    ## Summary: Machine Learning
    Some text here...

    ### 🎙️ Audio Overview
    [[audio_script:
    Welcome to your ScholarAI audio briefing on Machine Learning. Today we discuss supervised learning and neural networks.
    ]]
    """
    m = AUDIO_SCRIPT_RE.search(sample_text)
    assert m is not None
    assert "Welcome to your ScholarAI audio briefing" in m.group(1)
    assert "neural networks." in m.group(1)


def test_detect_source_type():
    # Pass dummy None for db since detect_source_type does not use it
    service = SourceService(None)  # type: ignore
    assert service.detect_source_type("https://www.youtube.com/watch?v=12345678901") == "youtube"
    assert service.detect_source_type("https://youtu.be/12345678901") == "youtube"
    assert service.detect_source_type("https://arxiv.org/pdf/2301.00001.pdf") == "pdf"
    assert service.detect_source_type("https://en.wikipedia.org/wiki/Artificial_intelligence") == "article"
