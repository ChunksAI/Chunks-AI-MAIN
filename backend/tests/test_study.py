"""Tests for the study blueprint (/generate-study-materials, /generate-quiz)."""
import pytest
from unittest.mock import MagicMock


def _study_mocks(monkeypatch):
    """Set up shared mocks for study endpoint tests."""
    import services.ai as ai_svc
    import services.device_abuse as device_mod
    import services.plan_limits as plan_mod

    monkeypatch.setattr(device_mod, 'check_device_rate_limit', MagicMock(return_value=None))
    monkeypatch.setattr(plan_mod, 'check_plan_limit', MagicMock(return_value=None))
    mock_ai = MagicMock(return_value="# Generated Materials\nContent here...")
    monkeypatch.setattr(ai_svc, 'call_ai', mock_ai)
    return mock_ai


SAMPLE_SLIDES = [
    {'slide_number': 1, 'title': 'Intro', 'content': ['Hello world'], 'notes': ''},
    {'slide_number': 2, 'title': 'Details', 'content': ['More content here'], 'notes': 'Speaker note'},
]


def test_study_materials_options(client):
    """OPTIONS /generate-study-materials returns 200."""
    resp = client.options('/generate-study-materials')
    assert resp.status_code == 200


def test_study_materials_no_slides(client, mock_guest_gate, mock_extract_user):
    """POST /generate-study-materials with no slides returns 400."""
    resp = client.post('/generate-study-materials', json={'type': 'notes', 'slides': []})
    assert resp.status_code == 400
    data = resp.json()
    assert data['success'] is False


def test_study_materials_success(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """POST /generate-study-materials returns materials when AI works."""
    import services.ai as ai_svc
    monkeypatch.setattr(ai_svc, 'call_ai', MagicMock(return_value="# Study Notes\nKey concepts..."))

    slides = [{'slide_number': 1, 'title': 'Intro', 'content': ['Hello world'], 'notes': ''}]
    resp = client.post('/generate-study-materials', json={'type': 'notes', 'slides': slides})
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'materials' in data


def test_quiz_options(client):
    """OPTIONS /generate-quiz returns 200."""
    resp = client.options('/generate-quiz')
    assert resp.status_code == 200


def test_quiz_no_slides(client, mock_guest_gate, mock_extract_user):
    """POST /generate-quiz with no slides returns 400."""
    resp = client.post('/generate-quiz', json={'slides': [], 'count': 5})
    assert resp.status_code == 400
    data = resp.json()
    assert data['success'] is False


def test_study_blueprints_registered(app):
    """Both study endpoints are registered."""
    rules = [r.path for r in app.routes]
    assert '/generate-study-materials' in rules
    assert '/generate-quiz' in rules


# ── generate-study-materials with different material types ───────────────────

def test_study_materials_reviewer(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Reviewer material type generates exam review content."""
    _study_mocks(monkeypatch)
    resp = client.post('/generate-study-materials', json={'type': 'reviewer', 'slides': SAMPLE_SLIDES})
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'reviewer' in data['materials']


def test_study_materials_flashcards(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Flashcards material type generates Q&A cards."""
    _study_mocks(monkeypatch)
    resp = client.post('/generate-study-materials', json={'type': 'flashcards', 'slides': SAMPLE_SLIDES})
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'flashcards' in data['materials']


def test_study_materials_summary(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Summary material type generates a summary sheet."""
    _study_mocks(monkeypatch)
    resp = client.post('/generate-study-materials', json={'type': 'summary', 'slides': SAMPLE_SLIDES})
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'summary' in data['materials']


def test_study_materials_quiz(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz material type generates practice questions."""
    _study_mocks(monkeypatch)
    resp = client.post('/generate-study-materials', json={'type': 'quiz', 'slides': SAMPLE_SLIDES})
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'quiz' in data['materials']


def test_study_materials_all(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """'all' material type generates comprehensive materials."""
    _study_mocks(monkeypatch)
    resp = client.post('/generate-study-materials', json={'type': 'all', 'slides': SAMPLE_SLIDES})
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'all' in data['materials']


def test_study_materials_unknown_type(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Unknown material type still generates materials using fallback prompt."""
    _study_mocks(monkeypatch)
    resp = client.post('/generate-study-materials', json={'type': 'custom_thing', 'slides': SAMPLE_SLIDES})
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'custom_thing' in data['materials']


def test_study_materials_truncation(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Long slide content is truncated to char_limit."""
    _study_mocks(monkeypatch)
    big_slides = [{'slide_number': 1, 'title': 'Big', 'content': ['x' * 30000], 'notes': ''}]
    resp = client.post('/generate-study-materials', json={'type': 'notes', 'slides': big_slides})
    assert resp.status_code == 200
    assert resp.json()['success'] is True


def test_study_materials_empty_content_slides(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Slides with empty content and no notes return 400."""
    _study_mocks(monkeypatch)
    empty_slides = [{'slide_number': 1, 'title': 'Empty', 'content': ['', '  '], 'notes': ''}]
    resp = client.post('/generate-study-materials', json={'type': 'notes', 'slides': empty_slides})
    assert resp.status_code == 400
    assert resp.json()['success'] is False


# ── generate-quiz with different difficulties and modes ──────────────────────

def test_quiz_success_easy(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz generation with easy difficulty succeeds."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. What is water?\nA) H2O\nB) NaCl\nC) CO2\nD) N2\nAnswer: A\nExplanation: Water is H2O."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[
        {'question': 'What is water?', 'options': ['H2O', 'NaCl', 'CO2', 'N2'], 'answer': 'A'}
    ]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 5,
        'difficulty': 'easy',
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert data['difficulty'] == 'easy'
    assert len(data['questions']) == 1


def test_quiz_success_hard(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz generation with hard difficulty succeeds."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. Advanced question..."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[{'question': 'Advanced'}]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 10,
        'difficulty': 'hard',
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert data['difficulty'] == 'hard'


def test_quiz_success_medium(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz generation with default (medium) difficulty succeeds."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. Medium question..."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[{'question': 'Medium'}]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 10,
        'difficulty': 'medium',
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert data['difficulty'] == 'medium'


def test_quiz_situational_mode(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Situational quiz mode adds scenario-based instruction."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. A patient presents with..."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[{'question': 'Situational'}]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 5,
        'difficulty': 'medium',
        'mode': 'situational',
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True


def test_quiz_no_readable_content(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz with slides that have no readable content returns 400."""
    _study_mocks(monkeypatch)
    empty_slides = [{'slide_number': 1, 'title': 'Empty', 'content': ['', '  '], 'notes': ''}]
    resp = client.post('/generate-quiz', json={
        'slides': empty_slides,
        'count': 5,
    })
    assert resp.status_code == 400
    data = resp.json()
    assert data['success'] is False
    assert 'No readable content' in data['error']


def test_quiz_parse_failure(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz returns 500 if MCQ parsing returns empty list."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Unparseable garbled output"
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 5,
    })
    assert resp.status_code == 500
    data = resp.json()
    assert data['success'] is False
    assert 'Could not parse' in data['error']


def test_quiz_with_existing_questions(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz generation with existingQuestions avoids repeats."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. New question..."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[{'question': 'New'}]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 5,
        'existingQuestions': ['What is water?', 'Define pH'],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True


# ── question_type field tests ────────────────────────────────────────────────


def test_quiz_question_type_truefalse(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz with question_type='truefalse' succeeds and includes type instruction in prompt."""
    import server as srv
    import services.ai as ai_svc
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. Water is H2O.\nA) True\nB) False\nAnswer: A\nExplanation: Correct."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[
        {'question': 'Water is H2O.', 'options': {'A': 'True', 'B': 'False'}, 'answer': 'A'}
    ]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 5,
        'question_type': 'truefalse',
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    # Verify the AI was called with a prompt containing the true/false instruction
    call_args = ai_svc.call_ai.call_args
    prompt_text = call_args[0][0] if call_args[0] else ''
    assert 'TRUE / FALSE' in prompt_text or 'true' in prompt_text.lower()


def test_quiz_question_type_fillinblank(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz with question_type='fillinblank' succeeds and includes fill-in-blank instruction."""
    import server as srv
    import services.ai as ai_svc
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. The chemical formula for water is ___.\nA) H2O\nB) NaCl\nC) CO2\nD) N2\nAnswer: A\nExplanation: Correct."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[
        {'question': 'The chemical formula for water is ___.', 'options': {'A': 'H2O', 'B': 'NaCl', 'C': 'CO2', 'D': 'N2'}, 'answer': 'A'}
    ]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 5,
        'question_type': 'fillinblank',
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    call_args = ai_svc.call_ai.call_args
    prompt_text = call_args[0][0] if call_args[0] else ''
    assert 'FILL IN THE BLANK' in prompt_text


def test_quiz_question_type_matching(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz with question_type='matching' succeeds and includes matching instruction."""
    import server as srv
    import services.ai as ai_svc
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. Match: H2O\nA) Water\nB) Salt\nC) Gas\nD) Metal\nAnswer: A\nExplanation: H2O is water."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[
        {'question': 'Match: H2O', 'options': {'A': 'Water', 'B': 'Salt', 'C': 'Gas', 'D': 'Metal'}, 'answer': 'A'}
    ]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 5,
        'question_type': 'matching',
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    call_args = ai_svc.call_ai.call_args
    prompt_text = call_args[0][0] if call_args[0] else ''
    assert 'MATCHING' in prompt_text


def test_quiz_invalid_question_type_defaults_to_mcq(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz with invalid question_type falls back to mcq."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. What is water?\nA) H2O\nB) NaCl\nC) CO2\nD) N2\nAnswer: A\nExplanation: Water is H2O."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[
        {'question': 'What is water?', 'options': {'A': 'H2O'}, 'answer': 'A'}
    ]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 5,
        'question_type': 'invalid_type',
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True


# ── _parse_mcq improvement tests ─────────────────────────────────────────────


def test_parse_mcq_true_false():
    """_parse_mcq can parse True/False questions with A-B options."""
    from server import _parse_mcq
    raw = (
        "Q1. Water is composed of hydrogen and oxygen.\n"
        "A) True\n"
        "B) False\n"
        "Answer: A\n"
        "Explanation: Water (H2O) is indeed composed of hydrogen and oxygen.\n"
        "\n"
        "Q2. Salt is an element.\n"
        "A) True\n"
        "B) False\n"
        "Answer: B\n"
        "Explanation: Salt (NaCl) is a compound, not an element."
    )
    questions = _parse_mcq(raw)
    assert len(questions) == 2
    assert questions[0]['options'] == {'A': 'True', 'B': 'False'}
    assert questions[0]['answer'] == 'A'
    assert questions[1]['answer'] == 'B'


def test_parse_mcq_extended_options():
    """_parse_mcq can parse questions with E and F options."""
    from server import _parse_mcq
    raw = (
        "Q1. Which elements are noble gases?\n"
        "A) Helium\n"
        "B) Neon\n"
        "C) Argon\n"
        "D) Krypton\n"
        "E) All of the above\n"
        "F) None of the above\n"
        "Answer: E\n"
        "Explanation: All listed elements are noble gases."
    )
    questions = _parse_mcq(raw)
    assert len(questions) == 1
    assert 'E' in questions[0]['options']
    assert 'F' in questions[0]['options']
    assert questions[0]['answer'] == 'E'


def test_parse_mcq_markdown_bold():
    """_parse_mcq handles markdown bold formatting (**Q1.**, **A)**) that some AI models emit."""
    from server import _parse_mcq
    raw = (
        "**Q1.** What is the primary function of the cell membrane?\n"
        "**A)** Energy production\n"
        "**B)** Regulating what enters and exits the cell\n"
        "**C)** DNA storage\n"
        "**D)** Protein synthesis\n"
        "**Answer:** B\n"
        "**Explanation:** The cell membrane controls transport into and out of the cell.\n"
        "\n"
        "**Q2.** Which organelle produces ATP?\n"
        "**A)** Nucleus\n"
        "**B)** Ribosome\n"
        "**C)** Mitochondria\n"
        "**D)** Golgi apparatus\n"
        "**Answer:** C\n"
        "**Explanation:** Mitochondria are the powerhouse of the cell."
    )
    questions = _parse_mcq(raw)
    assert len(questions) == 2
    assert questions[0]['answer'] == 'B'
    assert questions[0]['options']['A'] == 'Energy production'
    assert questions[1]['answer'] == 'C'


def test_parse_mcq_parenthesis_numbering():
    """_parse_mcq handles Q1) parenthesis-style question numbers."""
    from server import _parse_mcq
    raw = (
        "Q1) What is the role of ribosomes?\n"
        "A) Producing energy\n"
        "B) Synthesising proteins\n"
        "C) Storing DNA\n"
        "D) Transporting molecules\n"
        "Answer: B\n"
        "Explanation: Ribosomes are the site of protein synthesis in the cell.\n"
        "\n"
        "Q2) Where is DNA stored in a eukaryotic cell?\n"
        "A) Mitochondria\n"
        "B) Cell membrane\n"
        "C) Nucleus\n"
        "D) Ribosome\n"
        "Answer: C\n"
        "Explanation: DNA is housed in the nucleus of eukaryotic cells."
    )
    questions = _parse_mcq(raw)
    assert len(questions) == 2
    assert questions[0]['answer'] == 'B'
    assert questions[1]['answer'] == 'C'
