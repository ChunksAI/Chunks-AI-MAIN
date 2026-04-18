from __future__ import annotations
import re
from dataclasses import dataclass
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

# Common stop words excluded from viewer-reference token intersection
_STOP_WORDS = frozenset({
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'on',
    'at', 'by', 'for', 'with', 'about', 'as', 'into', 'through', 'it',
    'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
    'you', 'your', 'he', 'his', 'she', 'her', 'they', 'their', 'and',
    'or', 'but', 'if', 'so', 'yet', 'nor', 'not', 'no', 'what', 'how',
})


@dataclass(frozen=True)
class ClassificationResult:
    """Rich classification output returned by :func:`classify`.

    Fields
    ------
    primary_intent : Intent
        The dominant intent for the question.
    secondary_intent : Intent | None
        A second matching intent, present when the question has clear signals
        for more than one category (e.g. confused *and* procedural).
    confusion_level : float
        A 0.0–1.0 score reflecting how many confusion signals appear in the
        current message and the last 3 history messages.  Computed as
        ``min(1.0, current_hits * 0.3 + history_hits * 0.2)``.
    is_viewer_reference : bool
        ``True`` when the question shares at least one non-stop-word token
        with the first 20 words of ``viewer_state["visible_transcript_segment"]``.
    is_multi_intent : bool
        ``True`` when *secondary_intent* is not ``None``.
    """
    primary_intent: Intent
    secondary_intent: Intent | None
    confusion_level: float
    is_viewer_reference: bool
    is_multi_intent: bool


def _confusion_level(question: str, history: list | None) -> float:
    """Compute a 0.0–1.0 confusion score from the current message and history."""
    current_hits = len(_CONFUSED_PATTERNS.findall(question))
    score = current_hits * 0.3

    if history:
        for msg in history[-3:]:
            if msg.get('role') == 'user':
                content = msg.get('content', '')
                history_hits = len(_CONFUSED_PATTERNS.findall(content))
                score += history_hits * 0.2

    return min(1.0, score)


_PUNCT_RE = re.compile(r'[^\w]')


def _is_viewer_reference(question: str, viewer_state: dict | None) -> bool:
    """Return True if the question overlaps with the viewer's visible transcript."""
    if not viewer_state:
        return False
    segment = viewer_state.get('visible_transcript_segment', '') or ''
    if not segment:
        return False
    segment_tokens = {
        _PUNCT_RE.sub('', t) for t in segment.lower().split()[:20]
    } - _STOP_WORDS - {''}
    question_tokens = {
        _PUNCT_RE.sub('', t) for t in question.lower().split()
    } - _STOP_WORDS - {''}
    return bool(segment_tokens & question_tokens)


def _primary_intent(q: str, short: bool) -> Intent:
    """Determine primary intent using the classic priority chain."""
    if _CONFUSED_PATTERNS.search(q):
        return 'confused'
    if short:
        return 'chitchat' if _CHITCHAT_PATTERNS.search(q) else 'concept'
    if _CHITCHAT_PATTERNS.search(q):
        return 'chitchat'
    if _PROCEDURAL_PATTERNS.search(q):
        return 'procedural'
    if _CONCEPT_PATTERNS.search(q):
        return 'concept'
    return 'concept'


def _secondary_intent(q: str, primary: Intent, short: bool) -> Intent | None:
    """Return the second-best intent if a second pattern group also fires."""
    if short:
        return None

    remaining: list[Intent] = [
        i for i in ('confused', 'chitchat', 'procedural', 'concept')
        if i != primary
    ]

    checks: dict[Intent, re.Pattern[str]] = {
        'confused':   _CONFUSED_PATTERNS,
        'chitchat':   _CHITCHAT_PATTERNS,
        'procedural': _PROCEDURAL_PATTERNS,
        'concept':    _CONCEPT_PATTERNS,
    }

    for intent in remaining:
        if checks[intent].search(q):
            return intent
    return None


def classify(
    question: str,
    history: list | None = None,
    viewer_state: dict | None = None,
) -> ClassificationResult:
    """Classify a user question and return a rich :class:`ClassificationResult`.

    Parameters
    ----------
    question : str
        The user's current message.
    history : list | None
        Conversation history (list of ``{"role": ..., "content": ...}`` dicts).
        The last 3 user messages are checked for additional confusion signals.
    viewer_state : dict | None
        Optional viewer context.  When ``visible_transcript_segment`` is
        present, token overlap with the question sets ``is_viewer_reference``.
    """
    if not question or not question.strip():
        return ClassificationResult(
            primary_intent='chitchat',
            secondary_intent=None,
            confusion_level=0.0,
            is_viewer_reference=False,
            is_multi_intent=False,
        )

    q = question.strip()
    short = len(q) < _SHORT_MSG_THRESHOLD

    primary = _primary_intent(q, short)
    secondary = _secondary_intent(q, primary, short)
    conf_level = _confusion_level(q, history)
    viewer_ref = _is_viewer_reference(q, viewer_state)

    return ClassificationResult(
        primary_intent=primary,
        secondary_intent=secondary,
        confusion_level=conf_level,
        is_viewer_reference=viewer_ref,
        is_multi_intent=secondary is not None,
    )
