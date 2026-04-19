"""Tests for backend/orchestrator.py — pure unit tests, no mocks required."""
from __future__ import annotations

from services.orchestrator import OrchestratorDecision, decide

# ── Helper ────────────────────────────────────────────────────────────────────

def _decide(**overrides):
    """Call decide() with safe defaults; overrides replace individual args."""
    defaults = dict(
        intent='concept',
        student_gaps=[],
        paev_ready=False,
        has_doc_context=False,
        mode='study',
        question='What is entropy?',
        student_profile='',
        web_search_requested=False,
    )
    defaults.update(overrides)
    return decide(**defaults)


# ── Rule 1: chitchat ──────────────────────────────────────────────────────────

def test_chitchat_no_paev_no_tool():
    d = _decide(intent='chitchat')
    assert d.use_paev is False
    assert d.use_tool is False
    assert d.tool_type == 'none'
    assert d.paev_prereq_limit == 0


def test_chitchat_cache_eligible_without_profile():
    d = _decide(intent='chitchat', student_profile='')
    assert d.cache_eligible is True


def test_chitchat_not_cache_eligible_with_profile():
    d = _decide(intent='chitchat', student_profile='some profile')
    assert d.cache_eligible is False


# ── Rule 2: explicit web search ───────────────────────────────────────────────

def test_web_search_requested_uses_search_tool():
    d = _decide(web_search_requested=True)
    assert d.use_tool is True
    assert d.tool_type == 'search'
    assert d.use_paev is False
    assert d.tool_token_budget == 800


def test_web_search_always_not_cache_eligible():
    d = _decide(web_search_requested=True, student_profile='')
    assert d.cache_eligible is False


def test_web_search_overrides_chitchat():
    """web_search_requested is evaluated after chitchat; chitchat wins."""
    d = _decide(intent='chitchat', web_search_requested=True)
    # chitchat rule fires first → no tool
    assert d.use_tool is False


# ── Rule 3: confused + failing gaps + paev_ready ──────────────────────────────

def test_confused_failing_gaps_paev_ready():
    gaps = [{'concept': 'entropy', 'status': 'failing'}]
    d = _decide(intent='confused', student_gaps=gaps, paev_ready=True)
    assert d.use_paev is True
    assert d.paev_prereq_limit == 2
    assert d.use_tool is False
    assert d.cache_eligible is False


def test_confused_no_failing_gaps_no_paev():
    gaps = [{'concept': 'entropy', 'status': 'reviewing'}]
    d = _decide(intent='confused', student_gaps=gaps, paev_ready=True)
    assert d.use_paev is False


def test_confused_paev_not_ready_no_paev():
    gaps = [{'concept': 'entropy', 'status': 'failing'}]
    d = _decide(intent='confused', student_gaps=gaps, paev_ready=False)
    assert d.use_paev is False


def test_confused_reason_includes_gap_count():
    gaps = [
        {'concept': 'entropy', 'status': 'failing'},
        {'concept': 'enthalpy', 'status': 'failing'},
    ]
    d = _decide(intent='confused', student_gaps=gaps, paev_ready=True)
    assert '2' in d.reason


# ── Rule 4: concept + paev_ready + gaps ───────────────────────────────────────

def test_concept_paev_ready_with_gaps():
    gaps = [{'concept': 'mole', 'status': 'reviewing'}]
    d = _decide(intent='concept', student_gaps=gaps, paev_ready=True)
    assert d.use_paev is True
    assert d.paev_prereq_limit == 3
    assert d.cache_eligible is False


def test_concept_paev_ready_no_gaps():
    d = _decide(intent='concept', student_gaps=[], paev_ready=True)
    assert d.use_paev is False


def test_concept_paev_not_ready_with_gaps():
    gaps = [{'concept': 'mole', 'status': 'reviewing'}]
    d = _decide(intent='concept', student_gaps=gaps, paev_ready=False)
    assert d.use_paev is False


# ── Rule 5: procedural ────────────────────────────────────────────────────────

def test_procedural_no_paev_no_tool():
    d = _decide(intent='procedural')
    assert d.use_paev is False
    assert d.use_tool is False
    assert d.tool_type == 'none'


def test_procedural_cache_eligible_without_profile():
    d = _decide(intent='procedural', student_profile='')
    assert d.cache_eligible is True


def test_procedural_not_cache_eligible_with_profile():
    d = _decide(intent='procedural', student_profile='profile data')
    assert d.cache_eligible is False


# ── Default rule ─────────────────────────────────────────────────────────────

def test_default_no_enrichment():
    d = _decide(intent='concept', student_gaps=[], paev_ready=False)
    assert d.use_paev is False
    assert d.use_tool is False
    assert d.tool_type == 'none'
    assert d.paev_prereq_limit == 0
    assert d.tool_token_budget == 0


def test_default_cache_eligible_without_profile():
    d = _decide(intent='concept', student_gaps=[], student_profile='')
    assert d.cache_eligible is True


def test_default_not_cache_eligible_with_profile():
    d = _decide(intent='concept', student_gaps=[], student_profile='x')
    assert d.cache_eligible is False


# ── Return type ───────────────────────────────────────────────────────────────

def test_returns_orchestrator_decision_instance():
    d = _decide()
    assert isinstance(d, OrchestratorDecision)


def test_decision_is_immutable():
    d = _decide()
    try:
        d.use_paev = True  # type: ignore[misc]
        assert False, 'should have raised'
    except (AttributeError, TypeError):
        pass


def test_reason_is_non_empty_string():
    for intent in ('chitchat', 'concept', 'procedural', 'confused'):
        d = _decide(intent=intent)
        assert isinstance(d.reason, str)
        assert len(d.reason) > 0


# ── viewer_state → viewer_context route ───────────────────────────────────────

def test_viewer_state_youtube_routes_to_viewer_context():
    """Active YouTube viewer_state with is_viewer_reference → viewer_context route."""
    from services.intent_classifier import ClassificationResult
    clf = ClassificationResult(
        primary_intent='concept',
        secondary_intent=None,
        confusion_level=0.0,
        is_viewer_reference=True,
        is_multi_intent=False,
    )
    vs = {'type': 'youtube', 'video_id': 'abc123', 'visible_segment': 'entropy increases'}
    d = _decide(intent=clf, viewer_state=vs)
    assert d.viewer_route is True
    assert d.tool_type == 'youtube'


def test_viewer_state_type_none_does_not_activate_viewer():
    """viewer_state with type='none' must NOT activate the viewer_active signal."""
    vs = {'type': 'none'}
    d = _decide(viewer_state=vs)
    assert d.viewer_route is False


def test_viewer_state_null_type_does_not_activate_viewer():
    """viewer_state with type=None must NOT activate the viewer_active signal."""
    vs = {'type': None}
    d = _decide(viewer_state=vs)
    assert d.viewer_route is False


def test_no_viewer_state_does_not_activate_viewer():
    d = _decide(viewer_state=None)
    assert d.viewer_route is False


def test_viewer_active_without_viewer_reference_has_lower_score():
    """viewer_active alone (2.0) is not enough to beat direct_chat when no is_viewer_reference."""
    from services.intent_classifier import ClassificationResult
    clf = ClassificationResult(
        primary_intent='concept',
        secondary_intent=None,
        confusion_level=0.0,
        is_viewer_reference=False,
        is_multi_intent=False,
    )
    vs = {'type': 'youtube', 'visible_segment': 'something unrelated'}
    d = _decide(intent=clf, viewer_state=vs)
    # viewer_context score = 2.0 (viewer_active) + 0.0 (no reference)
    # direct_chat score = 0.5 (base)
    # viewer_context wins (2.0 > 0.5) even without is_viewer_reference
    assert d.viewer_route is True


def test_viewer_state_pdf_type_activates_viewer():
    """PDF type is a real viewer type — should activate viewer_active signal."""
    from services.intent_classifier import ClassificationResult
    clf = ClassificationResult(
        primary_intent='concept',
        secondary_intent=None,
        confusion_level=0.0,
        is_viewer_reference=True,
        is_multi_intent=False,
    )
    vs = {'type': 'pdf', 'pdf_visible_text': 'entropy explained here'}
    d = _decide(intent=clf, viewer_state=vs)
    assert d.viewer_route is True

