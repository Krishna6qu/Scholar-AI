"""Helpers for roadmap step completion and progress calculation."""


def step_key(phase_index: int, step_index: int) -> str:
    return f"{phase_index}:{step_index}"


def compute_progress(json_structure: dict, step_progress: dict[str, bool] | None) -> float:
    progress = step_progress or {}
    total = 0
    completed = 0
    for pi, phase in enumerate(json_structure.get("phases", [])):
        for si, _step in enumerate(phase.get("steps", [])):
            total += 1
            if progress.get(step_key(pi, si)):
                completed += 1
    if total == 0:
        return 0.0
    return round((completed / total) * 100, 1)


def enrich_structure(json_structure: dict, step_progress: dict[str, bool] | None) -> dict:
    """Merge is_completed flags into each step for API responses."""
    progress = step_progress or {}
    phases = []
    for pi, phase in enumerate(json_structure.get("phases", [])):
        steps = []
        for si, step in enumerate(phase.get("steps", [])):
            enriched = {**step, "is_completed": bool(progress.get(step_key(pi, si), False))}
            steps.append(enriched)
        phases.append({**phase, "steps": steps})
    return {"phases": phases}
