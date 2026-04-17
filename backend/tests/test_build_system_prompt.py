"""Pure unit tests for build_system_prompt in routes/chat.py.

The function is pure Python with no I/O, so no mocks are needed.
"""
from __future__ import annotations

_IDENTITY = "You are Chunks AI. "
_BOOK = "Chemistry by Zumdahl"
_LATEX = "Use LaTeX for equations."
_TEACHING = "TEACHING_SENTINEL"
_PAEV = "[PAEV CONTEXT]\nPrerequisite: entropy\nReason: foundational\nPage reference: 42"
_PROFILE = "[STUDENT PROFILE] gaps: entropy"


def _build(**overrides):
    from routes.chat import build_system_prompt
    defaults = dict(
        identity=_IDENTITY,
        book_label=_BOOK,
        is_relevant=True,
        latex_instruction=_LATEX,
        user_memory='',
        response_style='Be clear and complete.',
        teaching_prompt=_TEACHING,
        student_profile='',
        paev_context='',
        thinking_mode=None,
    )
    defaults.update(overrides)
    return build_system_prompt(**defaults)


# ── identity always appears first ─────────────────────────────────────────────

def test_identity_is_first():
    result = _build()
    assert result.startswith(_IDENTITY)


def test_identity_is_first_with_all_fields_populated():
    result = _build(
        user_memory='good student',
        student_profile=_PROFILE,
        paev_context=_PAEV,
        thinking_mode='thinking',
    )
    assert result.startswith(_IDENTITY)


# ── PAEV context → PHASE 1 / PHASE 2 markers ─────────────────────────────────

def test_paev_context_produces_phase_1_and_phase_2():
    result = _build(paev_context=_PAEV)
    assert 'PHASE 1' in result
    assert 'PHASE 2' in result


def test_empty_paev_context_has_no_phase_markers():
    result = _build(paev_context='')
    assert 'PHASE 1' not in result
    assert 'PHASE 2' not in result


def test_paev_context_includes_protocol_header():
    result = _build(paev_context=_PAEV)
    assert 'PREREQUISITE TEACHING PROTOCOL' in result


def test_paev_content_appears_in_output():
    result = _build(paev_context=_PAEV)
    assert 'entropy' in result


# ── student_profile always appears before paev_context ────────────────────────

def test_student_profile_before_paev_context():
    result = _build(student_profile=_PROFILE, paev_context=_PAEV)
    assert result.index(_PROFILE) < result.index(_PAEV)


def test_student_profile_before_paev_with_custom_sentinels():
    profile = 'PROFILE_SENTINEL_XYZ'
    paev = 'PAEV_SENTINEL_XYZ'
    result = _build(student_profile=profile, paev_context=paev)
    assert result.index(profile) < result.index(paev)


# ── thinking_mode='deep' → TEACHING_PROMPT excluded, thinking format included ─

def test_deep_mode_excludes_teaching_prompt():
    result = _build(thinking_mode='deep', teaching_prompt=_TEACHING)
    assert _TEACHING not in result


def test_deep_mode_includes_output_format_header():
    result = _build(thinking_mode='deep')
    assert 'OUTPUT FORMAT' in result


def test_deep_mode_includes_think_tag():
    result = _build(thinking_mode='deep')
    assert '<think>' in result


def test_deep_mode_includes_deep_specific_instructions():
    result = _build(thinking_mode='deep')
    assert 'DEEP mode' in result


def test_thinking_mode_includes_think_tag():
    result = _build(thinking_mode='thinking')
    assert '<think>' in result


def test_thinking_mode_includes_teaching_prompt():
    result = _build(thinking_mode='thinking', teaching_prompt=_TEACHING)
    assert _TEACHING in result


def test_normal_mode_includes_teaching_prompt():
    result = _build(thinking_mode=None, teaching_prompt=_TEACHING)
    assert _TEACHING in result


def test_normal_mode_has_no_think_tag():
    result = _build(thinking_mode=None)
    assert '<think>' not in result


# ── cache_eligible is orchestrator's concern, not tested here ─────────────────

# ── is_relevant role definition ───────────────────────────────────────────────

def test_relevant_mode_cites_book_label():
    result = _build(is_relevant=True, book_label=_BOOK)
    assert _BOOK in result


def test_irrelevant_mode_says_knowledgeable_tutor():
    result = _build(is_relevant=False)
    assert 'knowledgeable tutor' in result


def test_relevant_mode_says_expert_tutor():
    result = _build(is_relevant=True)
    assert 'expert tutor' in result


# ── user_memory ────────────────────────────────────────────────────────────────

def test_user_memory_included_when_present():
    result = _build(user_memory='prefers worked examples')
    assert 'prefers worked examples' in result
    assert 'USER PROFILE' in result


def test_user_memory_block_absent_when_empty():
    result = _build(user_memory='')
    assert 'USER PROFILE' not in result


# ── student_profile ────────────────────────────────────────────────────────────

def test_student_profile_present_in_output():
    result = _build(student_profile=_PROFILE)
    assert _PROFILE in result


def test_student_profile_absent_when_empty():
    result = _build(student_profile='')
    assert '[STUDENT PROFILE]' not in result


# ── return type ────────────────────────────────────────────────────────────────

def test_returns_string():
    assert isinstance(_build(), str)


def test_returns_non_empty():
    assert len(_build()) > 0
