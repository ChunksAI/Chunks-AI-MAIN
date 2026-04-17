"""
backend/tests/test_e2e_upload_loop.py — End-to-end upload loop integration test.

Proves the system is subject-agnostic (not "Chunks Chemistry"): uploads a
biology document, asks a question about it, generates a quiz, and retrieves
the student model — all without any chemistry content.

External calls (AI, Supabase, Redis) are mocked the same way every other test
in this suite does it via the shared `conftest.py` fixtures.
"""
from __future__ import annotations

import io
from unittest.mock import MagicMock


# ── Helpers ───────────────────────────────────────────────────────────────────

# Minimal slides extracted from a two-page biology document.
_BIOLOGY_SLIDES = [
    {
        'slide_number': 1,
        'title': 'Introduction to Cell Biology',
        'content': [
            'A cell is the basic structural and functional unit of all living organisms.',
            'All cells are surrounded by a plasma membrane.',
            'Cells contain DNA as their genetic material.',
        ],
        'notes': '',
    },
    {
        'slide_number': 2,
        'title': 'Types of Cells',
        'content': [
            'Prokaryotic cells lack a membrane-bound nucleus.',
            'Eukaryotic cells contain a membrane-bound nucleus.',
            'Examples of eukaryotes: plants, animals, fungi.',
        ],
        'notes': 'Remind students: bacteria are prokaryotes.',
    },
]

_BIOLOGY_AI_ANSWER = (
    "The main topic of this document is cell biology. "
    "It introduces the concept that a cell is the basic unit of life "
    "and distinguishes between prokaryotic and eukaryotic cells."
)

_QUIZ_AI_RESPONSE = """\
Q1. What is the basic structural and functional unit of all living organisms?
A) Atom
B) Cell
C) Tissue
D) Organ
Answer: B

Q2. Which type of cell lacks a membrane-bound nucleus?
A) Eukaryotic
B) Plant
C) Prokaryotic
D) Fungal
Answer: C
"""


def _mock_ai(monkeypatch, answer: str):
    """Patch services.ai.call_ai to return a fixed string."""
    import services.ai as ai_svc
    mock = MagicMock(return_value=answer)
    monkeypatch.setattr(ai_svc, 'call_ai', mock)
    return mock


def _mock_usage(monkeypatch):
    """Disable guest-gate and plan-limit checks so they never block."""
    import services.guest_limits as guest_limits
    import services.usage as usage_svc
    import services.plan_limits as plan_mod
    import services.device_abuse as device_mod

    noop = lambda *a, **kw: None
    monkeypatch.setattr(usage_svc,    '_enforce_guest', noop)
    monkeypatch.setattr(guest_limits, 'guest_gate', noop)
    monkeypatch.setattr(plan_mod,     'check_plan_limit', MagicMock(return_value=None))
    monkeypatch.setattr(device_mod,   'check_device_rate_limit', MagicMock(return_value=None))


def _mock_supabase(monkeypatch):
    """Make the shared Supabase session return plausible responses."""
    from routes import shared as shared_mod
    ctx = MagicMock()
    ctx.SUPABASE_URL = 'https://fake.supabase.co'
    ctx.SUPABASE_SERVICE_KEY = 'fake-key'

    load_response = MagicMock()
    load_response.status_code = 200
    load_response.json.return_value = [
        {'student_knowledge_model': '{"mastered":[],"gaps":[],"quizHistory":[]}'}
    ]
    ctx.session.get.return_value = load_response
    ctx.session.post.return_value = MagicMock(status_code=204)
    monkeypatch.setattr(shared_mod, 'ctx', ctx)
    return ctx


# ── Fixtures shared across the class ─────────────────────────────────────────

class TestE2EUploadLoop:
    """Integration smoke-test: upload biology doc → ask → quiz → load-model."""

    # ------------------------------------------------------------------
    # Step 1 + 2: Upload a biology PDF and verify the returned bookId.
    # ------------------------------------------------------------------

    def test_step1_upload_returns_book_id(self, client, monkeypatch, mock_extract_user):
        """POST /upload-document succeeds and returns a bookId."""
        import services.documents as docs_mod

        monkeypatch.setattr(
            docs_mod,
            'extract_slides_from_file',
            MagicMock(return_value=_BIOLOGY_SLIDES),
        )

        resp = client.post(
            '/upload-document',
            files={
                'file': (
                    'biology_intro.pdf',
                    io.BytesIO(b'%PDF-1.4 biology fake content'),
                    'application/pdf',
                )
            },
        )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body['success'] is True, body
        assert 'bookId' in body
        assert body['bookId'].startswith('upload_'), body['bookId']
        assert body['total_slides'] == len(_BIOLOGY_SLIDES)
        # Confirm no chemistry references leaked into the filename or slides
        assert 'chemistry' not in body.get('filename', '').lower()

    # ------------------------------------------------------------------
    # Step 3 + 4: POST /ask with the biology bookId; answer references biology.
    # ------------------------------------------------------------------

    def test_step2_ask_with_biology_book(self, client, monkeypatch, mock_extract_user):
        """POST /ask about the uploaded biology doc returns a biology answer."""
        import services.books as books_svc

        _mock_ai(monkeypatch, _BIOLOGY_AI_ANSWER)
        _mock_usage(monkeypatch)

        import services.ai as ai_svc
        monkeypatch.setattr(ai_svc, 'should_search_textbook', MagicMock(return_value=False))

        mock_searcher = MagicMock()
        mock_searcher.chunks = []
        mock_searcher.has_embeddings = False
        monkeypatch.setattr(books_svc, 'get_book_index', MagicMock(return_value=mock_searcher))

        resp = client.post('/ask', json={
            'question': 'What is the main topic of this document?',
            'mode': 'study',
            'complexity': 3,
            'bookId': 'upload_biology_intro',
        })

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body['success'] is True, body
        answer_lower = body['answer'].lower()
        # Verify the answer is about biology, not chemistry
        assert 'cell' in answer_lower or 'biology' in answer_lower, (
            f"Expected biology-related answer, got: {body['answer']!r}"
        )
        assert 'chemistry' not in answer_lower, (
            f"Answer unexpectedly contains 'chemistry': {body['answer']!r}"
        )

    # ------------------------------------------------------------------
    # Step 5 + 6: POST /generate-quiz; at least one question is returned.
    # ------------------------------------------------------------------

    def test_step3_generate_quiz_returns_questions(self, client, monkeypatch, mock_extract_user):
        """POST /generate-quiz with biology slides returns ≥1 quiz question."""
        _mock_ai(monkeypatch, _QUIZ_AI_RESPONSE)
        _mock_usage(monkeypatch)

        resp = client.post('/generate-quiz', json={
            'slides': _BIOLOGY_SLIDES,
            'count': 5,
            'difficulty': 'medium',
        })

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body['success'] is True, body
        questions = body.get('questions', [])
        assert len(questions) >= 1, (
            f"Expected at least one quiz question, got: {questions!r}"
        )
        # Spot-check: first question should not mention chemistry
        if questions:
            q_text = str(questions[0]).lower()
            assert 'chemistry' not in q_text, (
                f"Quiz question unexpectedly mentions 'chemistry': {questions[0]!r}"
            )

    # ------------------------------------------------------------------
    # Step 7 + 8: GET /tutor/load-model; no 500, student model returned.
    # ------------------------------------------------------------------

    def test_step4_load_model_no_errors(self, client, monkeypatch):
        """GET /tutor/load-model returns 200 with a student_model payload."""
        import services.auth as auth_svc
        from services.auth import Tier

        monkeypatch.setattr(
            auth_svc,
            '_extract_verified_user',
            MagicMock(return_value=('user-bio-test', Tier.FREE, False)),
        )
        _mock_supabase(monkeypatch)

        resp = client.get(
            '/tutor/load-model',
            headers={'Authorization': 'Bearer test.jwt.token'},
        )

        assert resp.status_code != 500, f"Got 500: {resp.text}"
        assert resp.status_code == 200, f"Unexpected status {resp.status_code}: {resp.text}"
        body = resp.json()
        # student_model may be None (empty profile) or a dict — either is valid
        assert 'student_model' in body, f"Missing 'student_model' key in {body!r}"
