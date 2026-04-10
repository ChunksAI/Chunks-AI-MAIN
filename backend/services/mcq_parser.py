"""
backend/services/mcq_parser.py — Parse AI-generated MCQ text into structured dicts.

Extracted from server.py to break the circular import between server.py and
the route files that previously did ``from server import _parse_mcq``.
"""
from __future__ import annotations

import re


# Matches the start of a question block in any of the formats an AI might use:
#   Q1.   Q1)   **Q1.**   **Q1)**   *Q1.*
_Q_BLOCK_SPLIT = re.compile(r'\n(?=\*{0,2}Q\d+[.)]\*{0,2}\s)')

# Strips markdown bold/italic asterisks from a string so patterns match cleanly.
_STRIP_MD = re.compile(r'\*+')


def _clean(s: str) -> str:
    """Remove markdown bold/italic markers (asterisks) from a line."""
    return _STRIP_MD.sub('', s)


def _parse_mcq(raw_text: str) -> list[dict]:
    """Parse AI-generated MCQ text into a list of question dicts.

    Handles the canonical ``Q1. / A) / Answer: / Explanation:`` format as
    well as common AI variations:

    * Markdown bold wrappers: ``**Q1.**``, ``**A)**``, ``**Answer: B**``
    * Parenthesis-style question numbers: ``Q1)`` instead of ``Q1.``
    * True/False (A–B options) as well as A–F options
    """
    questions = []
    blocks = _Q_BLOCK_SPLIT.split(raw_text.strip())

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        lines = block.splitlines()
        q_obj = {'number': None, 'question': '', 'options': {}, 'answer': '', 'explanation': ''}
        active_field = None
        explanation_lines = []

        for line in lines:
            stripped = line.strip()
            if not stripped:
                if active_field == 'explanation':
                    explanation_lines.append('')
                continue

            # Remove markdown bold/italic so patterns match regardless of formatting
            clean = _clean(stripped)

            m = re.match(r'^Q(\d+)[.)]\s*(.*)', clean)
            if m:
                q_obj['number'] = int(m.group(1))
                q_obj['question'] = m.group(2).strip()
                active_field = 'question'
                continue

            m = re.match(r'^([A-F])[).]\s*(.*)', clean)
            if m:
                q_obj['options'][m.group(1)] = m.group(2).strip()
                active_field = 'option'
                continue

            m = re.match(r'^Answer:\s*(.*)', clean, re.IGNORECASE)
            if m:
                q_obj['answer'] = m.group(1).strip()
                active_field = 'answer'
                continue

            m = re.match(r'^Explanation:\s*(.*)', clean, re.IGNORECASE)
            if m:
                first_line = m.group(1).strip()
                if first_line:
                    explanation_lines.append(first_line)
                active_field = 'explanation'
                continue

            if active_field == 'explanation':
                explanation_lines.append(clean)
            elif active_field == 'question':
                q_obj['question'] = q_obj['question'] + ' ' + clean

        if explanation_lines:
            q_obj['explanation'] = '\n'.join(explanation_lines).strip()

        if q_obj['number'] is not None:
            questions.append(q_obj)

    return questions
