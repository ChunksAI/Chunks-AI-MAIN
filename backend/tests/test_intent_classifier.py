"""Tests for backend/services/intent_classifier.py."""
from __future__ import annotations

import pytest

from services.intent_classifier import ClassificationResult, classify


# ── Specified test cases (from problem statement) ─────────────────────────────

class TestSpecifiedCases:
    def test_confused_dont_understand(self):
        assert classify("I don't understand entropy").primary_intent == 'confused'

    def test_concept_what_is(self):
        assert classify("What is entropy?").primary_intent == 'concept'

    def test_procedural_how_do_i(self):
        assert classify("How do I calculate entropy?").primary_intent == 'procedural'

    def test_chitchat_hi(self):
        assert classify("Hi").primary_intent == 'chitchat'

    def test_chitchat_thanks(self):
        assert classify("thanks").primary_intent == 'chitchat'

    def test_concept_why_is(self):
        assert classify("why is entropy always increasing").primary_intent == 'concept'

    def test_confused_doesnt_make_sense(self):
        assert classify("why doesn't my calculation make sense").primary_intent == 'confused'

    def test_chitchat_empty_string(self):
        assert classify("").primary_intent == 'chitchat'

    def test_concept_short_no_match(self):
        # "entropy?" is 8 chars, no chitchat pattern — defaults to 'concept'
        assert classify("entropy?").primary_intent == 'concept'


# ── Confused intent ───────────────────────────────────────────────────────────

class TestConfusedIntent:
    def test_i_dont_get_it(self):
        assert classify("I don't get this at all").primary_intent == 'confused'

    def test_i_dont_know(self):
        assert classify("I don't know what this means").primary_intent == 'confused'

    def test_confused_keyword(self):
        assert classify("I'm confused about the second law of thermodynamics").primary_intent == 'confused'

    def test_lost(self):
        assert classify("I'm totally lost in this chapter").primary_intent == 'confused'

    def test_stuck(self):
        assert classify("I'm stuck on this problem").primary_intent == 'confused'

    def test_not_sure(self):
        assert classify("I'm not sure how to approach this").primary_intent == 'confused'

    def test_can_you_re_explain(self):
        assert classify("Can you re-explain the concept of entropy?").primary_intent == 'confused'

    def test_can_you_clarify(self):
        assert classify("Can you clarify what you meant earlier?").primary_intent == 'confused'

    def test_doesnt_make_sense(self):
        assert classify("this doesn't make sense to me").primary_intent == 'confused'

    def test_confused_overrides_concept(self):
        # Has both confusion and concept signals — confused wins
        assert classify("I don't understand what entropy is").primary_intent == 'confused'

    def test_confused_overrides_procedural(self):
        # Has both confusion and procedural signals — confused wins
        assert classify("I don't know how to calculate entropy").primary_intent == 'confused'

    def test_how_come(self):
        assert classify("how come the pressure drops when volume increases?").primary_intent == 'confused'


# ── Procedural intent ─────────────────────────────────────────────────────────

class TestProceduralIntent:
    def test_how_do_i_solve(self):
        assert classify("How do I solve this differential equation?").primary_intent == 'procedural'

    def test_how_can_i(self):
        assert classify("How can I derive the formula for kinetic energy?").primary_intent == 'procedural'

    def test_how_would_we(self):
        assert classify("How would we calculate the equilibrium constant?").primary_intent == 'procedural'

    def test_step_by_step(self):
        assert classify("Give me a step by step solution for this problem").primary_intent == 'procedural'

    def test_calculate(self):
        assert classify("Calculate the molar mass of water").primary_intent == 'procedural'

    def test_solve(self):
        assert classify("Solve for x in 2x + 5 = 11").primary_intent == 'procedural'

    def test_derive(self):
        assert classify("Derive the formula for potential energy").primary_intent == 'procedural'

    def test_prove(self):
        assert classify("Prove that the square root of 2 is irrational").primary_intent == 'procedural'

    def test_show_me_how(self):
        assert classify("Show me how to integrate by parts").primary_intent == 'procedural'

    def test_walk_me_through(self):
        assert classify("Walk me through solving this quadratic").primary_intent == 'procedural'

    def test_what_are_the_steps(self):
        assert classify("What are the steps to balance a chemical equation?").primary_intent == 'procedural'

    def test_algorithm(self):
        assert classify("What algorithm is used for binary search?").primary_intent == 'procedural'

    def test_method(self):
        assert classify("What method should I use to find eigenvalues?").primary_intent == 'procedural'


# ── Concept intent ────────────────────────────────────────────────────────────

class TestConceptIntent:
    def test_what_is(self):
        assert classify("What is Newton's second law?").primary_intent == 'concept'

    def test_what_are(self):
        assert classify("What are the properties of noble gases?").primary_intent == 'concept'

    def test_define(self):
        assert classify("Define osmosis in biology").primary_intent == 'concept'

    def test_explain(self):
        assert classify("Explain the theory of relativity").primary_intent == 'concept'

    def test_describe(self):
        assert classify("Describe the structure of a DNA molecule").primary_intent == 'concept'

    def test_tell_me_about(self):
        assert classify("Tell me about the French Revolution").primary_intent == 'concept'

    def test_why_is(self):
        assert classify("Why is the sky blue?").primary_intent == 'concept'

    def test_how_does(self):
        assert classify("How does photosynthesis work?").primary_intent == 'concept'

    def test_difference(self):
        assert classify("What's the difference between mitosis and meiosis?").primary_intent == 'concept'

    def test_compare(self):
        assert classify("Compare ionic and covalent bonds").primary_intent == 'concept'

    def test_default_fallback(self):
        # No pattern matches — should default to 'concept'
        assert classify("Tell me something interesting about black holes").primary_intent == 'concept'

    def test_long_unmatched_defaults_to_concept(self):
        assert classify("The relationship between temperature and pressure in gases").primary_intent == 'concept'


# ── Chitchat intent ───────────────────────────────────────────────────────────

class TestChitchatIntent:
    def test_hello(self):
        assert classify("Hello!").primary_intent == 'chitchat'

    def test_hey(self):
        assert classify("Hey there").primary_intent == 'chitchat'

    def test_good_morning(self):
        assert classify("Good morning!").primary_intent == 'chitchat'

    def test_good_night(self):
        assert classify("Good night").primary_intent == 'chitchat'

    def test_thank_you(self):
        assert classify("Thank you so much!").primary_intent == 'chitchat'

    def test_how_are_you(self):
        assert classify("How are you doing today?").primary_intent == 'chitchat'

    def test_whats_up(self):
        assert classify("What's up?").primary_intent == 'chitchat'

    def test_bye(self):
        assert classify("Bye!").primary_intent == 'chitchat'

    def test_goodbye(self):
        assert classify("Goodbye, thanks for the help").primary_intent == 'chitchat'

    def test_who_are_you(self):
        assert classify("Who are you?").primary_intent == 'chitchat'

    def test_your_name(self):
        assert classify("What's your name?").primary_intent == 'chitchat'

    def test_awesome(self):
        assert classify("That's awesome!").primary_intent == 'chitchat'

    def test_none_input(self):
        assert classify(None).primary_intent == 'chitchat'  # type: ignore[arg-type]

    def test_whitespace_only(self):
        assert classify("   ").primary_intent == 'chitchat'


# ── Short message fast path ───────────────────────────────────────────────────

class TestShortMessageFastPath:
    def test_short_social(self):
        # < 15 chars and matches chitchat
        assert classify("Hi").primary_intent == 'chitchat'

    def test_short_non_social(self):
        # < 15 chars, no chitchat match → concept
        assert classify("entropy?").primary_intent == 'concept'

    def test_short_term_only(self):
        # single academic word
        assert classify("osmosis").primary_intent == 'concept'

    def test_exactly_at_threshold_social(self):
        # 14 chars, matches chitchat
        q = "thanks a lot!!"
        assert len(q) == 14
        assert classify(q).primary_intent == 'chitchat'


# ── ClassificationResult fields ───────────────────────────────────────────────

class TestClassificationResult:
    def test_returns_dataclass(self):
        r = classify("What is entropy?")
        assert isinstance(r, ClassificationResult)

    def test_result_is_immutable(self):
        r = classify("What is entropy?")
        try:
            r.primary_intent = 'chitchat'  # type: ignore[misc]
            assert False, 'should have raised'
        except (AttributeError, TypeError):
            pass

    def test_no_confusion_clear_concept(self):
        r = classify("What is entropy?")
        assert r.confusion_level == 0.0

    def test_confusion_level_increases_with_hits(self):
        # Two confusion patterns in the question → 2 * 0.3 = 0.6
        r = classify("I don't understand and I'm confused about entropy")
        assert r.confusion_level > 0.0

    def test_confusion_capped_at_one(self):
        # Many confusion patterns — score should not exceed 1.0
        r = classify(
            "I don't understand, I'm confused, I'm lost, I'm stuck, "
            "not sure what this means, can you re-explain, doesn't make sense"
        )
        assert r.confusion_level <= 1.0

    def test_is_multi_intent_true_when_secondary_present(self):
        r = classify("I don't understand how to calculate entropy step by step")
        assert r.secondary_intent is not None
        assert r.is_multi_intent is True

    def test_is_multi_intent_false_for_pure_chitchat(self):
        r = classify("Hi there")
        assert r.is_multi_intent is False

    def test_secondary_intent_none_for_unambiguous_question(self):
        r = classify("What is Newton's second law?")
        assert r.secondary_intent is None


# ── History-based confusion scoring ──────────────────────────────────────────

class TestHistoryConfusionLevel:
    def test_no_history_gives_current_only_score(self):
        r = classify("I don't get this", history=None)
        assert r.confusion_level == pytest.approx(0.3, abs=0.01)

    def test_history_confusion_increases_score(self):
        history = [
            {'role': 'user', 'content': "I'm confused about the last part"},
            {'role': 'assistant', 'content': 'Let me explain again.'},
        ]
        r_no_hist = classify("I don't get this")
        r_with_hist = classify("I don't get this", history=history)
        assert r_with_hist.confusion_level > r_no_hist.confusion_level

    def test_only_last_3_history_messages_counted(self):
        # 5 historical user messages with confusion — only last 3 should count
        history = [
            {'role': 'user', 'content': "I don't understand"},
            {'role': 'user', 'content': "I don't understand"},
            {'role': 'user', 'content': "I don't understand"},
            {'role': 'user', 'content': "I don't understand"},
            {'role': 'user', 'content': "I don't understand"},
        ]
        r = classify("What is entropy?", history=history)
        # Last 3 messages each contribute 0.3 per hit × 0.2 weight = 0.2 * 3 = 0.6
        assert r.confusion_level == pytest.approx(0.6, abs=0.05)

    def test_assistant_messages_not_counted(self):
        history = [
            {'role': 'assistant', 'content': "I don't understand your question"},
        ]
        r = classify("What is entropy?", history=history)
        assert r.confusion_level == 0.0

    def test_history_score_capped_at_one(self):
        history = [
            {'role': 'user', 'content': "I don't understand, I'm confused, I'm lost"},
            {'role': 'user', 'content': "I'm stuck and not sure about anything"},
            {'role': 'user', 'content': "can you re-explain, it doesn't make sense"},
        ]
        r = classify("I don't get this at all", history=history)
        assert r.confusion_level <= 1.0


# ── is_viewer_reference ───────────────────────────────────────────────────────

class TestViewerReference:
    def test_no_viewer_state_is_false(self):
        r = classify("What is entropy?", viewer_state=None)
        assert r.is_viewer_reference is False

    def test_empty_segment_is_false(self):
        r = classify("What is entropy?", viewer_state={'visible_transcript_segment': ''})
        assert r.is_viewer_reference is False

    def test_matching_token_is_true(self):
        viewer = {'visible_transcript_segment': 'entropy increases in closed systems over time'}
        r = classify("What is entropy?", viewer_state=viewer)
        assert r.is_viewer_reference is True

    def test_no_overlap_is_false(self):
        viewer = {'visible_transcript_segment': 'photosynthesis occurs in plant cells'}
        r = classify("What is entropy?", viewer_state=viewer)
        assert r.is_viewer_reference is False

    def test_stop_words_only_overlap_is_false(self):
        # Both question and segment share only stop words — should be False
        viewer = {'visible_transcript_segment': 'the is a in of'}
        r = classify("what is the answer?", viewer_state=viewer)
        assert r.is_viewer_reference is False
