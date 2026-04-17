from __future__ import annotations
import re
import logging

logger = logging.getLogger(__name__)

# Rough estimate: 1 token ≈ 4 characters (conservative for English)
_CHARS_PER_TOKEN = 4

def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // _CHARS_PER_TOKEN)


def compress_tool_context(
    raw_context: str,
    tool_type: str,          # 'youtube' | 'search' | 'doc'
    token_budget: int = 800,
    concept_keywords: list[str] | None = None,
) -> str:
    """
    Compress tool output to fit within token_budget.

    Strategy (in order):
    1. Extract the structured fields we care about (title, key points, concepts).
    2. If still over budget, score sentences by keyword relevance and keep top N.
    3. Hard truncate as last resort, always on a sentence boundary.

    Never raises — returns a truncated version of raw_context on any error.
    """
    if not raw_context:
        return ''

    # Guard against non-string inputs
    if not isinstance(raw_context, str):
        try:
            raw_context = str(raw_context)
        except Exception:
            return ''

    budget_chars = token_budget * _CHARS_PER_TOKEN

    # If already within budget, return as-is
    if len(raw_context) <= budget_chars:
        return raw_context

    try:
        # Step 1: Extract structured fields if present
        structured = _extract_structured_fields(raw_context, tool_type)
        if structured and len(structured) <= budget_chars:
            logger.debug('[compressor] %s: structured extraction fit budget (%d chars)', tool_type, len(structured))
            return structured

        # Step 2: Keyword-scored sentence selection
        if concept_keywords:
            scored = _keyword_scored_sentences(raw_context, concept_keywords, budget_chars)
            if scored:
                logger.debug('[compressor] %s: keyword scoring produced %d chars', tool_type, len(scored))
                return scored

        # Step 3: Hard truncate on sentence boundary
        truncated = _truncate_at_sentence(raw_context, budget_chars)
        logger.debug('[compressor] %s: hard truncated to %d chars', tool_type, len(truncated))
        return truncated

    except Exception:
        logger.exception('[compressor] error compressing %s context — hard truncating', tool_type)
        return raw_context[:budget_chars]


def _extract_structured_fields(text: str, tool_type: str) -> str:
    """Pull out [TOOL CONTEXT] block fields if present."""
    lines = text.split('\n')
    fields = []
    in_block = False
    for line in lines:
        if line.strip().startswith('[') and 'CONTEXT' in line:
            in_block = True
        if in_block:
            fields.append(line)
            # Stop after Key Points or Concepts section to stay concise
            if line.strip().lower().startswith('concepts:') or len(fields) > 20:
                break
    return '\n'.join(fields).strip() if fields else ''


def _keyword_scored_sentences(text: str, keywords: list[str], budget_chars: int) -> str:
    """Score sentences by keyword overlap and return top-scoring ones up to budget."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    kw_lower = [k.lower() for k in keywords]

    def score(s: str) -> int:
        sl = s.lower()
        return sum(1 for kw in kw_lower if kw in sl)

    scored = sorted(enumerate(sentences), key=lambda x: score(x[1]), reverse=True)
    selected_indices = set()
    total = 0
    for idx, sent in scored:
        if total + len(sent) > budget_chars:
            break
        selected_indices.add(idx)
        total += len(sent) + 1

    # Return in original order
    return ' '.join(s for i, s in enumerate(sentences) if i in selected_indices)


def _truncate_at_sentence(text: str, max_chars: int) -> str:
    """Truncate at the last sentence boundary before max_chars."""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_period = max(
        truncated.rfind('. '),
        truncated.rfind('! '),
        truncated.rfind('? '),
    )
    if last_period >= 0:
        return truncated[:last_period + 1]
    return truncated
