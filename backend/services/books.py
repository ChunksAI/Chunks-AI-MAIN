"""
backend/services/books.py — Book library, TextbookSearch, and book cache.

Provides:
  - BOOK_LIBRARY dict
  - STOPWORDS, tokenize(), tfidf_score(), enhanced_score() — TF-IDF helpers
  - TextbookSearch class — hybrid TF-IDF + semantic search
  - _book_cache / get_book_index() — per-book cached index
  - ALLOWED_EXTENSIONS / allowed_file()

Call init() once from server.py to inject shared state (session, API key, etc.).
"""
from __future__ import annotations

import logging
import math
import os
import re
import threading
from collections import Counter

from cachetools import TTLCache

logger = logging.getLogger(__name__)

# ── Module-level state injected at startup ─────────────────────────────────────
_session = None
OPENROUTER_API_KEY: str = ''
R2_BUCKET_URL: str = 'https://pub-xxxxx.r2.dev'

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    logger.warning("numpy not installed — semantic search disabled")


def init(session, openrouter_api_key: str, r2_bucket_url: str) -> None:
    """Inject shared dependencies. Call once from server.py at startup."""
    global _session, OPENROUTER_API_KEY, R2_BUCKET_URL
    _session           = session
    OPENROUTER_API_KEY = openrouter_api_key
    R2_BUCKET_URL      = r2_bucket_url
    # Rebuild BOOK_LIBRARY with the real R2 URL
    _build_book_library()


def _build_book_library() -> None:
    """(Re)populate BOOK_LIBRARY using the current R2_BUCKET_URL."""
    global BOOK_LIBRARY
    BOOK_LIBRARY = {
        'zumdahl': {
            'name': 'General Chemistry',
            'author': 'Zumdahl & Zumdahl',
            'chunks_url': f'{R2_BUCKET_URL}/data/zumdhal_chunks_with_embeddings.json',
            'pdf_url':    f'{R2_BUCKET_URL}/data/zumdhal.pdf'
        },
        'atkins': {
            'name': 'Physical Chemistry',
            'author': 'Atkins & de Paula',
            'chunks_url': f'{R2_BUCKET_URL}/data/atkins_chunks_with_embeddings.json',
            'pdf_url':    f'{R2_BUCKET_URL}/data/atkins_physical_chemistry.pdf'
        },
        'harris': {
            'name': 'Quantitative Chemical Analysis',
            'author': 'Daniel C. Harris',
            'chunks_url': f'{R2_BUCKET_URL}/data/harris_chunks_with_embeddings.json',
            'pdf_url':    f'{R2_BUCKET_URL}/data/harris_quantitative_analysis.pdf'
        },
        'klein': {
            'name': 'Organic Chemistry',
            'author': 'David Klein',
            'chunks_url': f'{R2_BUCKET_URL}/data/klein_chunks_with_embeddings.json',
            'pdf_url':    f'{R2_BUCKET_URL}/data/klein_organic_chemistry.pdf'
        },
        'berg': {
            'name': 'Biochemistry',
            'author': 'Berg, Tymoczko & Stryer',
            'chunks_url': f'{R2_BUCKET_URL}/data/berg_chunks_with_embeddings.json',
            'pdf_url':    f'{R2_BUCKET_URL}/data/berg_biochemistry.pdf'
        },
        'netter': {
            'name': 'Atlas of Human Anatomy',
            'author': 'Frank H. Netter',
            'chunks_url': f'{R2_BUCKET_URL}/data/atlas_chunks_with_embeddings.json',
            'pdf_url':    f'{R2_BUCKET_URL}/data/Atlas.pdf'
        },
        'anaphy2e': {
            'name': 'Anatomy & Physiology',
            'author': 'Patton & Thibodeau',
            'chunks_url': f'{R2_BUCKET_URL}/data/anaphy2e_chunks_with_embeddings.json',
            'pdf_url':    f'{R2_BUCKET_URL}/data/anaphy2e.pdf'
        }
    }
    # Backward-compat alias so old frontend bookId='biochemistry' still works
    BOOK_LIBRARY['biochemistry'] = BOOK_LIBRARY['berg']


# Initialise with placeholder so the name is always defined at import time.
BOOK_LIBRARY: dict = {}
_build_book_library()

# ── Allowed file types ────────────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.pptx', '.ppt'}


def allowed_file(filename: str) -> bool:
    return os.path.splitext(filename.lower())[1] in ALLOWED_EXTENSIONS


# ── TF-IDF helpers ────────────────────────────────────────────────────────────

STOPWORDS = {
    'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'for',
    'of', 'and', 'or', 'but', 'with', 'this', 'that', 'are', 'was',
    'be', 'as', 'by', 'from', 'what', 'how', 'why', 'when', 'where',
    'which', 'who', 'do', 'does', 'did', 'can', 'could', 'would',
    'should', 'will', 'have', 'has', 'had', 'not', 'if', 'so', 'its'
}


def tokenize(text):
    words = re.findall(r'[a-z]+', text.lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 2]


def tfidf_score(query_tokens, chunk_tokens, idf_map):
    tf = Counter(chunk_tokens)
    total = len(chunk_tokens) or 1
    score = 0.0
    for token in query_tokens:
        tf_val = tf.get(token, 0) / total
        idf_val = idf_map.get(token, 0)
        score += tf_val * idf_val
    return score


def enhanced_score(query_tokens, chunk, chunk_tokens, idf_map):
    base = tfidf_score(query_tokens, chunk_tokens, idf_map)
    text_lower = chunk.get('text', '').lower()
    total_words = len(chunk_tokens) or 1
    bonus = 0.0

    first_100 = text_lower[:100]
    for token in query_tokens:
        if text_lower.startswith(token) or f'{token} is' in first_100 or f'{token} are' in first_100:
            bonus += 0.015
        first_20pct = text_lower[:max(50, len(text_lower) // 5)]
        if token in first_20pct:
            bonus += 0.008

    query_phrase = ' '.join(query_tokens)
    if query_phrase in text_lower:
        bonus += 0.02
    for i in range(len(query_tokens) - 1):
        bigram = query_tokens[i] + ' ' + query_tokens[i + 1]
        if bigram in text_lower:
            bonus += 0.008

    tf = Counter(chunk_tokens)
    query_word_count = sum(tf.get(t, 0) for t in query_tokens)
    density = query_word_count / total_words
    bonus += min(density * 0.5, 0.025)

    if total_words > 300 and density < 0.02:
        bonus -= 0.005
    if total_words < 150 and base > 0:
        bonus += 0.005

    return base + bonus


# ── Module-level query embedding cache ───────────────────────────────────────
_global_query_cache: TTLCache = TTLCache(
    maxsize=2000,   # ~2 000 unique questions; each vector ≈ 6 KB → ~12 MB max
    ttl=4 * 3600,   # 4-hour TTL
)
_global_query_cache_lock = threading.Lock()


class TextbookSearch:
    # Cosine similarity threshold for hybrid search (embeddings active):
    LOW_CONFIDENCE_HYBRID  = 0.25
    # TF-IDF-only threshold (fallback when embeddings unavailable):
    LOW_CONFIDENCE_TFIDF   = 0.010

    EMBEDDING_MODEL = "openai/text-embedding-3-small"
    EMBEDDING_DIMS  = 1536

    def __init__(self):
        self.chunks            = []
        self.tokenized_chunks  = []
        self.idf_map           = {}
        self.book_id           = None
        self.embedding_matrix  = None
        self.has_embeddings    = False
        self._query_cache      = _global_query_cache

    def load_chunks_from_url(self, url, book_id=None):
        try:
            logger.info(f"📥 Fetching chunks from: {url}")
            response = _session.get(url, timeout=60)
            response.raise_for_status()
            chunks = response.json()
            logger.info(f"✅ Loaded {len(chunks)} chunks")

            self.chunks   = chunks
            self.book_id  = book_id

            # ── Build TF-IDF index ──────────────────────────────────────────
            self.tokenized_chunks = [tokenize(c.get('text', '')) for c in chunks]
            N  = len(self.tokenized_chunks)
            df = Counter()
            for tokens in self.tokenized_chunks:
                for t in set(tokens):
                    df[t] += 1
            self.idf_map = {t: math.log((N + 1) / (df[t] + 1)) for t in df}
            logger.info(f"✅ TF-IDF index: {len(self.idf_map)} unique terms")

            # ── Load embedding matrix if embeddings are present ──────────────
            try:
                first_with_emb = next((c for c in chunks if c.get('embedding')), None)
                if first_with_emb:
                    dims = len(first_with_emb['embedding'])
                    if dims == self.EMBEDDING_DIMS:
                        matrix = np.array(
                            [c['embedding'] for c in chunks],
                            dtype=np.float32
                        )
                        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
                        norms = np.where(norms == 0, 1, norms)
                        self.embedding_matrix = matrix / norms
                        self.has_embeddings   = True
                        logger.info(f"✅ Embedding matrix loaded: {matrix.shape}")
                    else:
                        logger.warning(
                            f"⚠️  Embedding dims={dims}, expected {self.EMBEDDING_DIMS}. "
                            f"Re-run process_book.py to regenerate. Falling back to TF-IDF."
                        )
                else:
                    logger.info(
                        "No embeddings in JSON — TF-IDF only. "
                        "Run process_book.py to add semantic search."
                    )
            except ImportError:
                logger.warning("numpy not installed — semantic search disabled. Run: pip install numpy")

            return True

        except Exception as e:
            logger.error(f"Error loading chunks: {e}")
            logger.exception("Unhandled error")
            return False

    def _embed_query(self, text: str):
        """
        Embed a query string using OpenRouter. Returns a normalised float32
        vector of shape (1536,), or None if the call fails.
        Results are cached in _query_cache.
        """
        with _global_query_cache_lock:
            cached = self._query_cache.get(text)
        if cached is not None:
            return cached

        try:
            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type":  "application/json",
                "HTTP-Referer":  "https://chunks.online",
                "X-Title":       "Chunks Chemistry"
            }
            payload = {
                "model": self.EMBEDDING_MODEL,
                "input": [text]
            }
            resp = _session.post(
                "https://openrouter.ai/api/v1/embeddings",
                headers=headers, json=payload, timeout=15
            )
            if resp.status_code == 200:
                vec  = np.array(resp.json()["data"][0]["embedding"], dtype=np.float32)
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec /= norm
                with _global_query_cache_lock:
                    self._query_cache[text] = vec
                return vec
            logger.warning(f"Embedding API {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Embedding query failed: {e}")

        return None

    def smart_search(self, question: str, top_k: int = 5):
        """
        Return (context_str, score, is_relevant, best_source, all_sources).
        """
        if not self.chunks:
            return "No textbook loaded.", 0.0, False, None, []

        query_tokens = tokenize(question)

        tfidf_scores = []
        for i, chunk in enumerate(self.chunks):
            s = enhanced_score(query_tokens, chunk, self.tokenized_chunks[i], self.idf_map) \
                if query_tokens else 0.0
            tfidf_scores.append(s)

        max_tfidf = max(tfidf_scores) if tfidf_scores else 1.0
        if max_tfidf > 0:
            tfidf_norm = [s / max_tfidf for s in tfidf_scores]
        else:
            tfidf_norm = tfidf_scores

        use_hybrid    = False
        final_scores  = list(tfidf_norm)
        low_conf      = self.LOW_CONFIDENCE_TFIDF

        if self.has_embeddings:
            query_vec = self._embed_query(question)
            if query_vec is not None:
                cosine = self.embedding_matrix.dot(query_vec)
                cosine = cosine.clip(0, 1).tolist()
                final_scores = [
                    0.70 * cos + 0.30 * tfidf
                    for cos, tfidf in zip(cosine, tfidf_norm)
                ]
                use_hybrid = True
                low_conf   = self.LOW_CONFIDENCE_HYBRID
            else:
                logger.warning("Query embedding failed — falling back to TF-IDF")

        scored = sorted(
            zip(self.chunks, final_scores),
            key=lambda x: x[1], reverse=True
        )

        top_score   = scored[0][1] if scored else 0.0
        is_relevant = top_score >= low_conf

        mode_label = "hybrid" if use_hybrid else "tfidf"
        logger.debug(f"[{mode_label}] score={top_score:.4f} relevant={is_relevant}")

        context = "\n\n".join([
            f"[Page {c['page']}] {c['text']}"
            for c, _ in scored[:top_k]
        ])

        all_sources = [
            {'page': int(c['page']), 'text': c.get('text', '')[:200]}
            for c, s in scored[:top_k]
            if s >= low_conf
        ]

        best_source = all_sources[0] if all_sources else None
        return context, top_score, is_relevant, best_source, all_sources

    def get_candidate_pages(self, topic: str, top_k: int = 5):
        if not self.chunks:
            return []
        query_tokens = tokenize(topic)
        scored = []
        for i, chunk in enumerate(self.chunks):
            score = enhanced_score(query_tokens, chunk, self.tokenized_chunks[i], self.idf_map)
            scored.append({'page': chunk['page'], 'text': chunk['text'], 'score': score})
        scored.sort(key=lambda x: x['score'], reverse=True)
        return scored[:top_k]


# ── Per-book index cache ──────────────────────────────────────────────────────
_book_cache: dict[str, TextbookSearch] = {}
_book_cache_lock = threading.Lock()


def get_book_index(book_id: str) -> TextbookSearch:
    """Return a cached (or freshly loaded) TextbookSearch for book_id.

    Uses double-checked locking:
      1. Fast check without lock — returns immediately for already-cached books.
      2. Acquire lock — only one thread loads a given book at a time.
      3. Check again inside lock — a concurrent thread may have finished
         loading while we waited.
    """
    if book_id in _book_cache:
        return _book_cache[book_id]

    if book_id not in BOOK_LIBRARY:
        return TextbookSearch()  # empty — is_relevant will be False

    with _book_cache_lock:
        if book_id in _book_cache:
            logger.debug(f"Book '{book_id}' loaded by concurrent thread — reusing cache.")
            return _book_cache[book_id]

        logger.info(f"Loading book index for '{book_id}' (no concurrent load in progress)")
        searcher = TextbookSearch()
        ok = searcher.load_chunks_from_url(BOOK_LIBRARY[book_id]['chunks_url'], book_id=book_id)
        if ok:
            _book_cache[book_id] = searcher
            mode = "hybrid (embeddings + TF-IDF)" if searcher.has_embeddings else "TF-IDF only"
            logger.info(f"✅ Cached [{mode}] index for: {book_id}")
        return searcher
