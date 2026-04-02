"""
backend/services/mcq_parser.py — Parse AI-generated MCQ text into structured dicts.

Extracted from server.py to break the circular import between server.py and
the route files that previously did ``from server import _parse_mcq``.
"""
from __future__ import annotations

import re


def _parse_mcq(raw_text: str) -> list[dict]:
    """Parse AI-generated MCQ text into a list of question dicts.

    Supports standard A-D multiple choice as well as A-B True/False
    format (options regex accepts A-F to be lenient).
    """
    questions = []
    blocks = re.split(r'\n(?=Q\d+\.)', raw_text.strip())

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

            m = re.match(r'^Q(\d+)\.\s*(.*)', stripped)
            if m:
                q_obj['number'] = int(m.group(1))
                q_obj['question'] = m.group(2)
                active_field = 'question'
                continue

            m = re.match(r'^([A-F])[).]\s*(.*)', stripped)
            if m:
                q_obj['options'][m.group(1)] = m.group(2)
                active_field = 'option'
                continue

            m = re.match(r'^Answer:\s*(.*)', stripped, re.IGNORECASE)
            if m:
                q_obj['answer'] = m.group(1).strip()
                active_field = 'answer'
                continue

            m = re.match(r'^Explanation:\s*(.*)', stripped, re.IGNORECASE)
            if m:
                first_line = m.group(1).strip()
                if first_line:
                    explanation_lines.append(first_line)
                active_field = 'explanation'
                continue

            if active_field == 'explanation':
                explanation_lines.append(stripped)
            elif active_field == 'question':
                q_obj['question'] = q_obj['question'] + ' ' + stripped

        if explanation_lines:
            q_obj['explanation'] = '\n'.join(explanation_lines).strip()

        if q_obj['number'] is not None:
            questions.append(q_obj)

    return questions
