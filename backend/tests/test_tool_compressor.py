"""Tests for backend/services/tool_compressor.py."""
from __future__ import annotations

import pytest

from services.tool_compressor import (
    compress_tool_context,
    _extract_structured_fields,
    _keyword_scored_sentences,
    _truncate_at_sentence,
)


# ── compress_tool_context ──────────────────────────────────────────────────────

class TestCompressToolContext:
    def test_returns_unchanged_when_under_budget(self):
        text = "Short text."
        result = compress_tool_context(text, tool_type='doc', token_budget=800)
        assert result == text

    def test_returns_empty_string_for_empty_input(self):
        assert compress_tool_context('', tool_type='doc') == ''

    def test_returns_empty_string_for_none_like_empty(self):
        assert compress_tool_context('', tool_type='youtube') == ''

    def test_extracts_structured_context_block(self):
        long_padding = "Irrelevant noise. " * 300
        block = "[TOOL CONTEXT]\nTitle: Entropy\nKey Points: increases in isolated systems.\nConcepts: thermodynamics"
        text = block + "\n" + long_padding
        result = compress_tool_context(text, tool_type='doc', token_budget=50)
        assert 'CONTEXT' in result
        assert 'Entropy' in result
        # Should not include the long padding
        assert len(result) < len(long_padding)

    def test_keyword_sentences_prioritized(self):
        irrelevant = "The cat sat on the mat. " * 50
        relevant = "Entropy increases in isolated thermodynamic systems."
        text = irrelevant + relevant
        result = compress_tool_context(
            text,
            tool_type='doc',
            token_budget=30,
            concept_keywords=['entropy'],
        )
        assert 'entropy' in result.lower() or 'Entropy' in result

    def test_falls_back_to_hard_truncate_without_keywords(self):
        text = "A" * 10000
        result = compress_tool_context(text, tool_type='doc', token_budget=100)
        assert len(result) <= 400 + 10  # 100 tokens * 4 chars + small margin

    def test_never_raises_on_malformed_input(self):
        for bad in [None, 123, [], {}, object()]:
            try:
                result = compress_tool_context(bad, tool_type='doc')  # type: ignore[arg-type]
                # Either returns empty/falsy or a string — no exception
                assert result == '' or isinstance(result, str)
            except Exception as exc:
                pytest.fail(f"compress_tool_context raised on {bad!r}: {exc}")

    def test_doc_type_works(self):
        text = "Some document content. " * 400
        result = compress_tool_context(text, tool_type='doc', token_budget=50)
        assert len(result) <= 50 * 4 + 10

    def test_youtube_type_works(self):
        text = "Transcript line. " * 400
        result = compress_tool_context(text, tool_type='youtube', token_budget=50)
        assert len(result) <= 50 * 4 + 10

    def test_search_type_works(self):
        text = "Search result snippet. " * 400
        result = compress_tool_context(text, tool_type='search', token_budget=50)
        assert len(result) <= 50 * 4 + 10

    def test_exact_budget_boundary_unchanged(self):
        # Exactly at budget: should be returned unchanged
        text = "x" * (100 * 4)
        result = compress_tool_context(text, tool_type='doc', token_budget=100)
        assert result == text


# ── _extract_structured_fields ─────────────────────────────────────────────────

class TestExtractStructuredFields:
    def test_extracts_context_block(self):
        text = "[VIDEO CONTEXT]\nTitle: Entropy\nKey Points: disorder increases.\n"
        result = _extract_structured_fields(text, 'youtube')
        assert '[VIDEO CONTEXT]' in result
        assert 'Entropy' in result

    def test_returns_empty_when_no_block(self):
        text = "Just some plain text without any context markers."
        result = _extract_structured_fields(text, 'doc')
        assert result == ''

    def test_stops_at_concepts_line(self):
        text = (
            "[TOOL CONTEXT]\n"
            "Title: Test\n"
            "Key Points: something\n"
            "Concepts: A, B, C\n"
            "This line should not appear in the output because we stop at concepts.\n"
        )
        result = _extract_structured_fields(text, 'doc')
        assert 'should not appear' not in result

    def test_stops_after_20_lines(self):
        lines = ["[SEARCH CONTEXT]"] + [f"Line {i}" for i in range(30)]
        text = "\n".join(lines)
        result = _extract_structured_fields(text, 'search')
        result_lines = result.split('\n')
        assert len(result_lines) <= 21  # header + up to 20


# ── _keyword_scored_sentences ─────────────────────────────────────────────────

class TestKeywordScoredSentences:
    def test_prioritizes_keyword_sentences(self):
        sentences = [
            "The sky is blue.",
            "Entropy is a measure of disorder in thermodynamics.",
            "Cats are mammals.",
        ]
        text = " ".join(sentences)
        result = _keyword_scored_sentences(text, ['entropy'], budget_chars=200)
        assert 'Entropy' in result or 'entropy' in result.lower()

    def test_respects_budget(self):
        text = "Entropy is everywhere. " * 100
        result = _keyword_scored_sentences(text, ['entropy'], budget_chars=100)
        assert len(result) <= 100 + 50  # small margin for sentence endings

    def test_returns_original_order(self):
        sentences = [
            "First sentence about entropy.",
            "Second sentence about temperature.",
            "Third sentence also about entropy.",
        ]
        text = " ".join(sentences)
        result = _keyword_scored_sentences(text, ['entropy'], budget_chars=500)
        # First entropy sentence should appear before third
        first_pos = result.find("First sentence")
        third_pos = result.find("Third sentence")
        if first_pos != -1 and third_pos != -1:
            assert first_pos < third_pos

    def test_empty_keywords_scores_nothing(self):
        text = "Some text. More text."
        result = _keyword_scored_sentences(text, [], budget_chars=500)
        # No keywords means all sentences score 0 — still returns something
        assert isinstance(result, str)


# ── _truncate_at_sentence ──────────────────────────────────────────────────────

class TestTruncateAtSentence:
    def test_returns_unchanged_if_within_budget(self):
        text = "Hello world."
        assert _truncate_at_sentence(text, 1000) == text

    def test_truncates_at_sentence_boundary(self):
        text = "First sentence. Second sentence. Third sentence."
        result = _truncate_at_sentence(text, 25)
        assert result.endswith('.')
        assert 'Third' not in result

    def test_ends_with_period_not_mid_word(self):
        text = "Short. " + "x" * 200
        result = _truncate_at_sentence(text, 50)
        # Should end at 'Short.' not mid-x-string
        assert result == "Short."

    def test_handles_exclamation_boundary(self):
        text = "Watch out! " + "y" * 300
        result = _truncate_at_sentence(text, 50)
        assert result.endswith('!')

    def test_handles_question_boundary(self):
        text = "Is this correct? " + "z" * 300
        result = _truncate_at_sentence(text, 50)
        assert result.endswith('?')

    def test_falls_back_to_char_truncate_when_no_sentence_found(self):
        text = "abcdefghijklmnopqrstuvwxyz" * 10
        result = _truncate_at_sentence(text, 20)
        # No sentence boundary — should still return something truncated
        assert len(result) <= 20
        assert isinstance(result, str)

    def test_always_within_max_chars(self):
        import random, string
        random.seed(42)
        text = ''.join(random.choices(string.ascii_letters + ' .!?', k=2000))
        for budget in [50, 100, 300, 500]:
            result = _truncate_at_sentence(text, budget)
            assert len(result) <= budget, f"Result length {len(result)} exceeds budget {budget}"
