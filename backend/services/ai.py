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
