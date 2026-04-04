"""
backend/services/ai.py — AI calling helpers.

Provides:
  - sanitize_text() / sanitize_user_memory() / _INJECTION_PATTERNS
  - call_ai() — call OpenRouter for standard chat completions
  - call_ai_web_search() — Perplexity Sonar via OpenRouter for live web results
  - should_search_textbook() — gating logic for textbook search

All functions rely on module-level state injected by init() at startup.
"""
from __future__ import annotations

import logging
import os
import re
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)

# ── Module-level state injected at startup ─────────────────────────────────────
_session = None
OPENROUTER_API_KEY: str = ''
OPENROUTER_URL: str = "https://openrouter.ai/api/v1/chat/completions"
MAX_HISTORY_TURNS: int = 10
MODEL: str = 'openai/gpt-oss-20b:nitroe'
SYSTEM_PROMPT_PREVIEW_LENGTH: int = 300


def init(session, openrouter_api_key: str, model: str,
         max_history_turns: int = 10) -> None:
    """Inject shared dependencies. Call once from server.py at startup."""
    global _session, OPENROUTER_API_KEY, MODEL, MAX_HISTORY_TURNS
    _session           = session
    OPENROUTER_API_KEY = openrouter_api_key
    MODEL              = model
    MAX_HISTORY_TURNS  = max_history_turns


# ── Input sanitisation ────────────────────────────────────────────────────────

def sanitize_text(text, max_len=2000):
    text = str(text).replace('\x00', '').strip()
    return text[:max_len]


_INJECTION_PATTERNS = re.compile(
    r'ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?'
    r'|you\s+are\s+now\s+(a|an|the|dan|jailbreak)'
    r'|forget\s+(everything|all|your|the)\s+(you|previous|prior|above|instructions?|rules?|context|system)'
    r'|disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|rules?|context|system|prompt)'
    r'|act\s+as\s+(if\s+you\s+are\s+)?(a\s+)?(dan|jailbreak|unrestricted|unfiltered|evil)'
    r'|system\s*:\s*|<\s*/?system\s*>'
    r'|<\s*/?(?:instruction|prompt|context)\s*>'
    r'|\[\s*(?:SYSTEM|INST|INSTRUCTION)\s*\]'
    r'|###\s*(?:system|instruction|new prompt)'
    r'|role\s*:\s*(system|assistant)',
    re.IGNORECASE,
)


def sanitize_user_memory(text, max_len=500):
    if not text:
        return ''
    cleaned = str(text).replace('\x00', '').strip()[:max_len]
    from services.prompt_guard import check_injection_regex
    if check_injection_regex(cleaned):
        logger.warning(
            "Prompt injection attempt in user_memory — field cleared. "
            "Preview: %r", cleaned[:120]
        )
        return ''
    return cleaned


# ── Thinking content extractor ────────────────────────────────────────────────

# Markers that clearly signal the start of a "final answer" paragraph inside
# a <think> block when the model forgets to write the answer after </think>.
_FINAL_ANSWER_MARKER = re.compile(
    r'(?:'
    r'\*{0,2}(?:final\s+answer|my\s+answer)\*{0,2}\s*[:\-–]'
    r'|(?:in\s+(?:summary|conclusion|short))[,:]?\s'
    r')',
    re.IGNORECASE,
)

# Patterns that indicate the "final answer" is just a social closing rather
# than real educational content (e.g. "Hope that clears things up!").
_SOCIAL_CLOSE_RE = re.compile(
    r'(?:hope\s+(?:that|this)\s+(?:helps?|clears?|answers?)'
    r'|let\s+me\s+know\s+if\s+you\s+(?:have|need)'
    r'|feel\s+free\s+to\s+ask'
    r'|don\'t\s+hesitate\s+to'
    r'|here\s+to\s+help'
    r'|always\s+here\s+to)',
    re.IGNORECASE,
)


def _is_thin_answer(answer: str, thinking: str) -> bool:
    """Return True when *answer* is just a social closing rather than real content.

    Triggered when:
    - The answer is short (≤ 300 characters) — longer answers are real content.
    - The answer contains a recognised social-close phrase.
    - The thinking block has enough content that salvage is worth attempting.
    """
    if not answer or not thinking:
        return False
    if len(answer) > 300:
        return False
    if len(thinking) < 150:
        return False
    return bool(_SOCIAL_CLOSE_RE.search(answer))


def _salvage_substantive_from_thinking(thinking: str) -> str:
    """Find the most content-rich paragraph in a thinking block.

    Used as a last resort when the model wrote only a social closing as its
    final answer and the actual educational content appears to be inside the
    ``<think>`` block (e.g. in a "Mental Sandbox:" section).

    Returns the paragraph with the highest word count that looks like real
    prose (multi-line or > 30 words), or ``''`` if nothing substantive is found.
    """
    if not thinking:
        return ''

    paragraphs = [p.strip() for p in thinking.split('\n\n') if p.strip()]
    if not paragraphs:
        return ''

    def _score(p: str) -> int:
        words = len(p.split())
        # Penalise short single-line planning notes / headers
        if '\n' not in p and words < 20:
            return 0
        return words

    best = max(paragraphs, key=_score)
    return best if _score(best) >= 30 else ''


def _salvage_answer_from_thinking(thinking: str) -> tuple[str, str]:
    """Try to split a ``thinking`` string into *(answer, updated_thinking)*.

    Called when a model embeds its entire response — including the final
    answer — inside the ``<think>`` block, leaving nothing after ``</think>``.
    Strategy:
      1. Look for an explicit "Final answer:" / "In summary:" marker paragraph.
      2. Fall back to the last double-newline-separated paragraph.

    Returns ``('', thinking)`` when no usable split point is found.
    """
    if not thinking:
        return '', thinking

    # 1. Explicit final-answer marker anywhere in the text
    m = _FINAL_ANSWER_MARKER.search(thinking)
    if m:
        # Walk back to the start of that paragraph (after the preceding \n\n)
        split_at = thinking.rfind('\n\n', 0, m.start())
        split_at = split_at + 2 if split_at != -1 else m.start()
        candidate = thinking[split_at:].strip()
        if candidate:
            return candidate, thinking[:split_at].strip()

    # 2. Last blank-line-separated paragraph as a fallback
    last_break = thinking.rfind('\n\n')
    if last_break != -1:
        candidate = thinking[last_break:].strip()
        if candidate:
            return candidate, thinking[:last_break].strip()

    return '', thinking


def extract_thinking_content(text: str) -> tuple[str, str | None]:
    """Extract ``<think>…</think>`` reasoning blocks from a model response.

    Some reasoning models (e.g. DeepSeek-R1, QwQ, Gemini 2.5 Flash) wrap
    their internal chain-of-thought inside ``<think>`` tags before emitting
    the final answer.  This helper peels that block out so the caller can
    surface it separately in the UI without polluting the visible answer text.

    Also handles three edge cases:
    * **Unclosed ``<think>``** — model truncated mid-thought; everything after
      the opening tag is treated as thinking content.
    * **Answer inside ``<think>``** — the model wrote the final answer inside
      the block with nothing after ``</think>``.  In this case the last
      paragraph of the thinking content is salvaged as the answer so the user
      always sees a meaningful response.
    * **Thin social-close answer** — the model put all real content in
      ``<think>`` and wrote only a brief social closing (e.g. "Hope that
      clears things up!") after ``</think>``.  The most substantive paragraph
      from the thinking block is surfaced as the answer instead.

    Returns:
        (answer, thinking) — *thinking* is ``None`` when no ``<think>`` block
        is present, otherwise the stripped inner text.
    """
    if not text:
        return text, None
    # Closed <think>…</think> block — strip all occurrences, capture first
    match = re.search(r'<think>([\s\S]*?)</think>', text, re.IGNORECASE)
    if match:
        thinking = match.group(1).strip()
        answer = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE).strip()
        # If nothing came after </think>, the model embedded the answer inside
        # the thinking block — salvage the final answer from there.
        if not answer and thinking:
            answer, thinking = _salvage_answer_from_thinking(thinking)
        # If the answer is just a thin social closing, try to surface the most
        # substantive paragraph from the thinking block instead.
        elif _is_thin_answer(answer, thinking):
            salvaged = _salvage_substantive_from_thinking(thinking)
            if salvaged:
                answer = salvaged
        return answer, thinking or None
    # Unclosed <think> tag — everything from the tag onward is thinking content
    partial = re.search(r'<think>([\s\S]*)', text, re.IGNORECASE)
    if partial:
        thinking = partial.group(1).strip()
        answer = text[:partial.start()].strip()
        if not answer and thinking:
            answer, thinking = _salvage_answer_from_thinking(thinking)
        elif _is_thin_answer(answer, thinking):
            salvaged = _salvage_substantive_from_thinking(thinking)
            if salvaged:
                answer = salvaged
        return answer, thinking or None
    return text, None


# ── Core AI caller ────────────────────────────────────────────────────────────

def call_ai(prompt, system_prompt="You are an expert chemistry tutor.", model=None,
            history=None, max_tokens_override=None, endpoint: str = 'chat',
            user_id: str = ''):
    """Call OpenRouter for a standard chat completion.

    Parameters
    ----------
    endpoint : str
        Key into ``token_budget.ENDPOINT_MAX_TOKENS`` used to resolve the
        hard token ceiling for this request (default ``'chat'``).
    user_id : str
        Authenticated user identifier for per-user usage tracking.
    """
    from services import token_budget

    # ── Budget gate ───────────────────────────────────────────────────────
    if not token_budget.check_daily_budget():
        raise RuntimeError("Daily AI cost budget exceeded. Please try again after midnight UTC.")

    use_model = model or MODEL

    # ── Resolve max_tokens ────────────────────────────────────────────────
    effective_max_tokens = token_budget.max_tokens_for_endpoint(
        endpoint, override=max_tokens_override,
    )

    try:
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://chunks.online",
            "X-Title": "Chunks Chemistry"
        }
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for h in history[-MAX_HISTORY_TURNS:]:
                role = h.get("role", "user")
                content = h.get("content", "")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": use_model,
            "messages": messages,
            # FIX: lowered temperature from 0.4 → 0.15
            # Chemistry facts, equations, and constants must be deterministic.
            "temperature": 0.15,
            "max_tokens": effective_max_tokens,
        }
        _system_preview = (system_prompt or "")[:SYSTEM_PROMPT_PREVIEW_LENGTH]
        logger.info(
            "[SYSTEM_PROMPT] len=%d | preview=%s",
            len(system_prompt or ""), _system_preview,
        )
        logger.info(
            "Model: %s | max_tokens: %d | endpoint: %s | history: %d turns",
            use_model, effective_max_tokens, endpoint,
            len(history) if history else 0,
        )
        response = _session.post(OPENROUTER_URL, headers=headers, json=payload, timeout=55)
        if response.status_code == 200:
            resp_json = response.json()
            choices = resp_json.get('choices', [])
            if choices:
                _record_usage_from_response(resp_json, use_model, endpoint, user_id=user_id)
                return choices[0]['message']['content']
            err = resp_json.get('error', {})
            raise RuntimeError(f"Model returned no choices — {err.get('message', str(resp_json)[:200])}")
        # Treat upstream 429 as a retriable rate-limit, everything else as a
        # server error. Raising here lets callers (e.g. generate mode) handle
        # it cleanly instead of receiving an unparseable error string.
        status = response.status_code
        snippet = response.text[:200]
        logger.error(f"API error {status}: {response.text[:300]}")
        if status == 429:
            raise RuntimeError(f"Upstream model rate-limited (429). Please retry in a moment.")
        raise RuntimeError(f"Upstream API returned {status}: {snippet}")
    except requests.Timeout:
        raise RuntimeError("The AI model timed out. Please try again.")
    except RuntimeError:
        raise  # re-raise our own clean errors
    except Exception as e:
        logger.exception("Unhandled error in call_ai")
        raise RuntimeError(str(e)) from e


def _record_usage_from_response(
    resp_json: dict, model: str, endpoint: str, user_id: str = '',
) -> None:
    """Extract usage stats from an OpenRouter response and record them."""
    from services import token_budget

    usage = resp_json.get('usage') or {}
    prompt_tokens     = int(usage.get('prompt_tokens', 0) or 0)
    completion_tokens = int(usage.get('completion_tokens', 0) or 0)
    total_cost        = float(resp_json.get('total_cost', 0) or 0)

    if prompt_tokens or completion_tokens or total_cost:
        token_budget.record_usage(
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_cost=total_cost,
            endpoint=endpoint,
            user_id=user_id,
        )
        logger.info(
            "Usage — model: %s | prompt: %d | completion: %d | cost: $%.6f | endpoint: %s | user: %s",
            model, prompt_tokens, completion_tokens, total_cost, endpoint, user_id or 'anonymous',
        )


def call_ai_web_search(question, system_prompt=None, history=None, user_id: str = ''):
    """
    Uses Perplexity Sonar via OpenRouter for real-time web search with citations.
    Returns (answer_text, citations_list)
    citations_list is a list of dicts: [{url, title}]
    """
    from services import token_budget

    if not token_budget.check_daily_budget():
        return "Error: Daily AI cost budget exceeded. Please try again after midnight UTC.", []

    WEB_MODEL = os.environ.get('WEB_MODEL', 'perplexity/sonar')
    effective_max_tokens = token_budget.max_tokens_for_endpoint('chat_web_search')

    try:
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type":  "application/json",
            "HTTP-Referer":  "https://chunks.online",
            "X-Title":       "Chunks Chemistry"
        }

        sys_prompt = system_prompt or (
            "You are a helpful research assistant. Answer clearly and accurately using "
            "current web information. Always include specific references to the sources "
            "you used. Format your answer in clean markdown with headers where appropriate."
        )

        messages = [{"role": "system", "content": sys_prompt}]
        if history:
            for h in (history or [])[-MAX_HISTORY_TURNS:]:
                role    = h.get("role", "user")
                content = h.get("content", "")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": question})

        payload = {
            "model": WEB_MODEL,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": effective_max_tokens,
        }

        logger.info(f"Web search model: {WEB_MODEL} | Q: {question[:80]}")
        response = _session.post(OPENROUTER_URL, headers=headers, json=payload, timeout=60)

        if response.status_code != 200:
            logger.error(f"Web search API error {response.status_code}: {response.text[:300]}")
            return f"Web search error: {response.status_code}", []

        resp_json = response.json()
        choices   = resp_json.get('choices', [])
        if not choices:
            return "No results returned.", []

        _record_usage_from_response(resp_json, WEB_MODEL, 'chat_web_search', user_id=user_id)

        answer = choices[0]['message']['content']

        # Perplexity via OpenRouter returns citations at top level or in choices
        raw_citations = (
            resp_json.get('citations') or
            choices[0].get('message', {}).get('citations') or
            choices[0].get('delta', {}).get('citations') or
            []
        )

        # Normalize citations — can be strings (URLs) or dicts
        citations = []
        seen_urls = set()
        for c in raw_citations:
            if isinstance(c, str) and c.startswith('http'):
                url = c
                # Try to derive a title from domain
                try:
                    domain = urlparse(url).netloc.replace('www.', '')
                    title  = domain
                except Exception:
                    title = url
                if url not in seen_urls:
                    seen_urls.add(url)
                    citations.append({'url': url, 'title': title})
            elif isinstance(c, dict):
                url   = c.get('url', '')
                title = c.get('title') or c.get('name') or ''
                if not title and url:
                    try:
                            title = urlparse(url).netloc.replace('www.', '')
                    except Exception:
                        title = url
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    citations.append({'url': url, 'title': title})

        # Also extract any URLs embedded in the answer text as fallback
        if not citations:
            found_urls = re.findall(r'https?://[^\s\)\]\>\"\']+', answer)
            for url in found_urls:
                url = url.rstrip('.,;:')
                if url not in seen_urls:
                    seen_urls.add(url)
                    try:
                            title = urlparse(url).netloc.replace('www.', '')
                    except Exception:
                        title = url
                    citations.append({'url': url, 'title': title})

        logger.info(f"Web search complete | citations: {len(citations)}")
        return answer, citations

    except requests.Timeout:
        return "Error: Web search timed out. Please try again.", []
    except Exception as e:
        logger.exception("Web search error")
        return f"Error: {str(e)}", []


# ── Textbook search gating ────────────────────────────────────────────────────
#
# Subject-agnostic — if a book is loaded, ALWAYS attempt textbook search.
# The LOW_CONFIDENCE threshold already filters out bad matches.
# The only questions we skip are obvious non-study chit-chat.

_SKIP_PATTERNS = re.compile(
    r'^(hi+|hey+|hello|howdy|sup|yo+|hiya)[!?,.\s]*$'           # pure greetings
    r'|^(thanks?|thank you|thx|ty|tysm)[!?,.\s]*$'              # thank-yous
    r'|^(ok|okay|got it|sure|cool|nice|great|perfect)[!?,.\s]*$'# one-word acks
    r'|^(who (are|made|created|built) you)'                      # AI identity
    r'|^(what (is your name|can you do|are you))'               # AI capability
    r'|^(how are you|are you (ok|good|alive|sentient))'         # AI wellbeing
    r'|^(lol|lmao|haha|hehe|😂|👍|🙏)[!?,.\s]*$',              # reactions
    re.IGNORECASE
)


def should_search_textbook(question: str, chunks_loaded: bool) -> bool:
    """
    Return True if we should search the loaded textbook for this question.

    Rules:
    - If no book is loaded → False (nothing to search)
    - If the question is obvious non-study chit-chat → False
    - Everything else → True (let the LOW_CONFIDENCE threshold decide relevance)
    """
    if not chunks_loaded:
        return False
    q = question.strip()
    if not q:
        return False
    # Skip very short non-questions (< 3 words and no '?')
    if len(q.split()) < 3 and '?' not in q and not any(c.isdigit() for c in q):
        if _SKIP_PATTERNS.match(q):
            return False
    return True
