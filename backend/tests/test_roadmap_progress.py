from app.core.roadmap_progress import compute_progress, enrich_structure, step_key


def test_step_key():
    assert step_key(0, 2) == "0:2"


def test_compute_progress_empty():
    assert compute_progress({"phases": []}, {}) == 0.0


def test_compute_progress_partial():
    structure = {
        "phases": [
            {"steps": [{"title": "a"}, {"title": "b"}]},
            {"steps": [{"title": "c"}]},
        ]
    }
    progress = {"0:0": True, "0:1": False, "1:0": True}
    assert compute_progress(structure, progress) == 66.7


def test_enrich_structure_merges_completion():
    structure = {"phases": [{"steps": [{"title": "Learn Python", "description": "..."}]}]}
    enriched = enrich_structure(structure, {"0:0": True})
    assert enriched["phases"][0]["steps"][0]["is_completed"] is True
