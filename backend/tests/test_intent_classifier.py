"""Tests for backend/services/intent_classifier.py."""
from __future__ import annotations

import pytest

from services.intent_classifier import classify


# ── Specified test cases (from problem statement) ─────────────────────────────

class TestSpecifiedCases:
    def test_confused_dont_understand(self):
        assert classify("I don't understand entropy") == 'confused'

    def test_concept_what_is(self):
        assert classify("What is entropy?") == 'concept'

    def test_procedural_how_do_i(self):
        assert classify("How do I calculate entropy?") == 'procedural'

    def test_chitchat_hi(self):
        assert classify("Hi") == 'chitchat'

    def test_chitchat_thanks(self):
        assert classify("thanks") == 'chitchat'

    def test_concept_why_is(self):
        assert classify("why is entropy always increasing") == 'concept'

    def test_confused_doesnt_make_sense(self):
        assert classify("why doesn't my calculation make sense") == 'confused'

    def test_chitchat_empty_string(self):
        assert classify("") == 'chitchat'

    def test_concept_short_no_match(self):
        # "entropy?" is 8 chars, no chitchat pattern — defaults to 'concept'
        assert classify("entropy?") == 'concept'


# ── Confused intent ───────────────────────────────────────────────────────────

class TestConfusedIntent:
    def test_i_dont_get_it(self):
        assert classify("I don't get this at all") == 'confused'

    def test_i_dont_know(self):
        assert classify("I don't know what this means") == 'confused'

    def test_confused_keyword(self):
        assert classify("I'm confused about the second law of thermodynamics") == 'confused'

    def test_lost(self):
        assert classify("I'm totally lost in this chapter") == 'confused'

    def test_stuck(self):
        assert classify("I'm stuck on this problem") == 'confused'

    def test_not_sure(self):
        assert classify("I'm not sure how to approach this") == 'confused'

    def test_can_you_re_explain(self):
        assert classify("Can you re-explain the concept of entropy?") == 'confused'

    def test_can_you_clarify(self):
        assert classify("Can you clarify what you meant earlier?") == 'confused'

    def test_doesnt_make_sense(self):
        assert classify("this doesn't make sense to me") == 'confused'

    def test_confused_overrides_concept(self):
        # Has both confusion and concept signals — confused wins
        assert classify("I don't understand what entropy is") == 'confused'

    def test_confused_overrides_procedural(self):
        # Has both confusion and procedural signals — confused wins
        assert classify("I don't know how to calculate entropy") == 'confused'

    def test_how_come(self):
        assert classify("how come the pressure drops when volume increases?") == 'confused'


# ── Procedural intent ─────────────────────────────────────────────────────────

class TestProceduralIntent:
    def test_how_do_i_solve(self):
        assert classify("How do I solve this differential equation?") == 'procedural'

    def test_how_can_i(self):
        assert classify("How can I derive the formula for kinetic energy?") == 'procedural'

    def test_how_would_we(self):
        assert classify("How would we calculate the equilibrium constant?") == 'procedural'

    def test_step_by_step(self):
        assert classify("Give me a step by step solution for this problem") == 'procedural'

    def test_calculate(self):
        assert classify("Calculate the molar mass of water") == 'procedural'

    def test_solve(self):
        assert classify("Solve for x in 2x + 5 = 11") == 'procedural'

    def test_derive(self):
        assert classify("Derive the formula for potential energy") == 'procedural'

    def test_prove(self):
        assert classify("Prove that the square root of 2 is irrational") == 'procedural'

    def test_show_me_how(self):
        assert classify("Show me how to integrate by parts") == 'procedural'

    def test_walk_me_through(self):
        assert classify("Walk me through solving this quadratic") == 'procedural'

    def test_what_are_the_steps(self):
        assert classify("What are the steps to balance a chemical equation?") == 'procedural'

    def test_algorithm(self):
        assert classify("What algorithm is used for binary search?") == 'procedural'

    def test_method(self):
        assert classify("What method should I use to find eigenvalues?") == 'procedural'


# ── Concept intent ────────────────────────────────────────────────────────────

class TestConceptIntent:
    def test_what_is(self):
        assert classify("What is Newton's second law?") == 'concept'

    def test_what_are(self):
        assert classify("What are the properties of noble gases?") == 'concept'

    def test_define(self):
        assert classify("Define osmosis in biology") == 'concept'

    def test_explain(self):
        assert classify("Explain the theory of relativity") == 'concept'

    def test_describe(self):
        assert classify("Describe the structure of a DNA molecule") == 'concept'

    def test_tell_me_about(self):
        assert classify("Tell me about the French Revolution") == 'concept'

    def test_why_is(self):
        assert classify("Why is the sky blue?") == 'concept'

    def test_how_does(self):
        assert classify("How does photosynthesis work?") == 'concept'

    def test_difference(self):
        assert classify("What's the difference between mitosis and meiosis?") == 'concept'

    def test_compare(self):
        assert classify("Compare ionic and covalent bonds") == 'concept'

    def test_default_fallback(self):
        # No pattern matches — should default to 'concept'
        assert classify("Tell me something interesting about black holes") == 'concept'

    def test_long_unmatched_defaults_to_concept(self):
        assert classify("The relationship between temperature and pressure in gases") == 'concept'


# ── Chitchat intent ───────────────────────────────────────────────────────────

class TestChitchatIntent:
    def test_hello(self):
        assert classify("Hello!") == 'chitchat'

    def test_hey(self):
        assert classify("Hey there") == 'chitchat'

    def test_good_morning(self):
        assert classify("Good morning!") == 'chitchat'

    def test_good_night(self):
        assert classify("Good night") == 'chitchat'

    def test_thank_you(self):
        assert classify("Thank you so much!") == 'chitchat'

    def test_how_are_you(self):
        assert classify("How are you doing today?") == 'chitchat'

    def test_whats_up(self):
        assert classify("What's up?") == 'chitchat'

    def test_bye(self):
        assert classify("Bye!") == 'chitchat'

    def test_goodbye(self):
        assert classify("Goodbye, thanks for the help") == 'chitchat'

    def test_who_are_you(self):
        assert classify("Who are you?") == 'chitchat'

    def test_your_name(self):
        assert classify("What's your name?") == 'chitchat'

    def test_awesome(self):
        assert classify("That's awesome!") == 'chitchat'

    def test_none_input(self):
        assert classify(None) == 'chitchat'  # type: ignore[arg-type]

    def test_whitespace_only(self):
        assert classify("   ") == 'chitchat'


# ── Short message fast path ───────────────────────────────────────────────────

class TestShortMessageFastPath:
    def test_short_social(self):
        # < 15 chars and matches chitchat
        assert classify("Hi") == 'chitchat'

    def test_short_non_social(self):
        # < 15 chars, no chitchat match → concept
        assert classify("entropy?") == 'concept'

    def test_short_term_only(self):
        # single academic word
        assert classify("osmosis") == 'concept'

    def test_exactly_at_threshold_social(self):
        # 14 chars, matches chitchat
        q = "thanks a lot!!"
        assert len(q) == 14
        assert classify(q) == 'chitchat'
