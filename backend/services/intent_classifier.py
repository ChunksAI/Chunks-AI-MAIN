from __future__ import annotations
import re
from typing import Literal

Intent = Literal['concept', 'procedural', 'confused', 'chitchat']

# Confusion signals — student is struggling with something
_CONFUSED_PATTERNS = re.compile(
    r'\b(i don\'?t (get|understand|know)|confused|lost|stuck|not sure|what does .+ mean'
    r'|can you (re-?explain|clarify|go over again)|doesn\'?t .{0,40}make sense'
    r'|why does|how come|i thought .+ was|isn\'?t .+ supposed to)\b',
    re.IGNORECASE,
)

# Procedural — how-to, step-by-step, calculation
_PROCEDURAL_PATTERNS = re.compile(
    r'\b(how (do|can|would) (i|you|we)|step(s| by step)|calculate|solve|derive|prove'
    r'|show me how|walk me through|what are the steps|procedure|algorithm|method)\b',
    re.IGNORECASE,
)

# Concept — what/why/define/explain
_CONCEPT_PATTERNS = re.compile(
    r'\b(what is|what are|define|explain|describe|tell me about|what does .+ mean'
    r'|why is|why does|how does|what\'?s the (difference|relationship)|compare)\b',
    re.IGNORECASE,
)

# Chitchat — social, off-topic
_CHITCHAT_PATTERNS = re.compile(
    r'\b(hi|hello|hey|thanks|thank you|good morning|good night|how are you'
    r'|what\'?s up|nice|cool|awesome|bye|goodbye|who are you|your name)\b',
    re.IGNORECASE,
)

# Short messages are almost always chitchat or very simple — fast path
_SHORT_MSG_THRESHOLD = 15   # characters


def classify(question: str) -> Intent:
    """
    Classify a user question into an intent.

    Priority order (first match wins):
    1. confused — strongest signal, override everything
    2. chitchat — short or social
    3. procedural — how-to
    4. concept — what/why/explain
    5. default → concept
    """
    if not question or not question.strip():
        return 'chitchat'

    q = question.strip()

    # Confused overrides everything — student needs extra support
    if _CONFUSED_PATTERNS.search(q):
        return 'confused'

    # Short message check — before regex spam
    if len(q) < _SHORT_MSG_THRESHOLD:
        # Short messages that match chitchat patterns → chitchat
        if _CHITCHAT_PATTERNS.search(q):
            return 'chitchat'
        # Short but not social → treat as concept (could be "entropy?", "mitosis?")
        return 'concept'

    if _CHITCHAT_PATTERNS.search(q):
        return 'chitchat'

    if _PROCEDURAL_PATTERNS.search(q):
        return 'procedural'

    if _CONCEPT_PATTERNS.search(q):
        return 'concept'

    # Default — most academic questions are concept questions
    return 'concept'
