-- ============================================================
-- Migration: 002_vector_search.sql
-- Purpose:   pgvector-backed similarity search for book chunks.
--            Replaces in-memory numpy dot-product with indexed
--            cosine similarity inside Supabase Postgres.
--
-- To run:
--   Supabase Dashboard → SQL Editor → paste & run
--   OR: supabase db push  (if using CLI)
-- ============================================================

-- ── Enable pgvector ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS book_chunks (
    id           BIGSERIAL   PRIMARY KEY,
    book_id      TEXT        NOT NULL,
    chunk_index  INTEGER     NOT NULL,
    page         INTEGER,
    text_preview TEXT,                        -- first 200 chars for debugging
    embedding    vector(1536),                -- text-embedding-3-small dimensions
    metadata     JSONB       DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT now(),

    UNIQUE (book_id, chunk_index)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- HNSW index for fast approximate nearest-neighbour cosine search.
-- ef_construction=128 gives good recall; m=16 is the default connectivity.
CREATE INDEX IF NOT EXISTS book_chunks_embedding_idx
    ON book_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- B-tree on book_id for fast filtering
CREATE INDEX IF NOT EXISTS book_chunks_book_id_idx
    ON book_chunks (book_id);

-- ── Row-level security ────────────────────────────────────────────────────────
-- Backend uses service_role key (bypasses RLS).  Deny all public access.

ALTER TABLE book_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all_public" ON book_chunks
    FOR ALL USING (false);

-- ── RPC: match_book_chunks ────────────────────────────────────────────────────
-- Called from the backend to perform cosine similarity search.
-- Returns chunk_index, page, and similarity score (1 - cosine distance).

CREATE OR REPLACE FUNCTION match_book_chunks(
    query_embedding  vector(1536),
    p_book_id        TEXT,
    p_top_k          INTEGER DEFAULT 50
)
RETURNS TABLE (
    chunk_index  INTEGER,
    page         INTEGER,
    similarity   DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        bc.chunk_index,
        bc.page,
        (1 - (bc.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity
    FROM book_chunks bc
    WHERE bc.book_id = p_book_id
    ORDER BY bc.embedding <=> query_embedding
    LIMIT p_top_k;
END;
$$;

-- ── RPC: match_paragraphs ─────────────────────────────────────────────────────
-- Same search but for PAEV paragraph embeddings (stored with a namespaced
-- book_id like "paev:<book_id>").

CREATE OR REPLACE FUNCTION match_paragraphs(
    query_embedding  vector(1536),
    p_book_id        TEXT,
    p_top_k          INTEGER DEFAULT 50
)
RETURNS TABLE (
    chunk_index  INTEGER,
    page         INTEGER,
    similarity   DOUBLE PRECISION,
    metadata     JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        bc.chunk_index,
        bc.page,
        (1 - (bc.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
        bc.metadata
    FROM book_chunks bc
    WHERE bc.book_id = p_book_id
    ORDER BY bc.embedding <=> query_embedding
    LIMIT p_top_k;
END;
$$;
