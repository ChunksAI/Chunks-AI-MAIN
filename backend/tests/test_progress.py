"""Tests for progress_routes.py — student progress & learning intelligence endpoints."""
from __future__ import annotations

from datetime import date, timedelta


# ── OPTIONS preflight ─────────────────────────────────────────────────────────

def test_readiness_options(client):
    r = client.options('/progress/readiness')
    assert r.status_code == 200


def test_weak_spots_options(client):
    r = client.options('/progress/weak-spots')
    assert r.status_code == 200


def test_study_plan_options(client):
    r = client.options('/progress/study-plan')
    assert r.status_code == 200


def test_badges_options(client):
    r = client.options('/progress/badges')
    assert r.status_code == 200


def test_streak_check_options(client):
    r = client.options('/progress/streak-check')
    assert r.status_code == 200


# ── POST /progress/readiness ─────────────────────────────────────────────────

def test_readiness_empty_progress(client):
    r = client.post('/progress/readiness', json={'progress': {}})
    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] is True
    assert 'readiness' in body
    assert 'breakdown' in body
    assert body['readiness'] == 0


def test_readiness_with_data(client):
    future_date = (date.today() + timedelta(days=7)).strftime('%Y-%m-%d')
    r = client.post('/progress/readiness', json={
        'examDate': future_date,
        'progress': {
            'quizResults': [{'score': 80}, {'score': 90}],
            'topics': {'thermo': {}, 'kinetics': {}, 'acids': {}},
            'totalCards': 100,
            'totalCorrect': 75,
            'studyStreak': 5,
            'totalStudyTime': 120,
        },
    })
    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] is True
    assert 0 < body['readiness'] <= 100
    bk = body['breakdown']
    assert bk['quiz_performance'] > 0
    assert bk['topic_coverage'] > 0
    assert bk['flashcard_mastery'] > 0
    assert bk['consistency'] > 0
    assert bk['study_time'] > 0


def test_readiness_verdict_high(client):
    """Readiness ≥85 → ready verdict."""
    r = client.post('/progress/readiness', json={
        'progress': {
            'quizResults': [{'score': 95}],
            'topics': {f't{i}': {} for i in range(15)},
            'totalCards': 100,
            'totalCorrect': 98,
            'studyStreak': 10,
            'totalStudyTime': 600,
        },
    })
    body = r.get_json()
    assert body['readiness'] >= 85
    assert 'ready' in body['verdict'].lower() or 'sleep' in body['verdict'].lower()


def test_readiness_no_exam_date(client):
    """Without examDate, consistency uses streak * 10 formula."""
    r = client.post('/progress/readiness', json={
        'progress': {'studyStreak': 3},
    })
    assert r.status_code == 200
    body = r.get_json()
    assert body['breakdown']['consistency'] == 30


# ── POST /progress/weak-spots ────────────────────────────────────────────────

def test_weak_spots_empty(client):
    r = client.post('/progress/weak-spots', json={'progress': {}})
    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] is True
    assert body['weakSpots'] == []


def test_weak_spots_with_quiz(client):
    r = client.post('/progress/weak-spots', json={
        'progress': {
            'quizResults': [
                {'topic': 'Thermodynamics', 'score': 40, 'totalQuestions': 10,
                 'wrongTopics': ['entropy', 'enthalpy']},
                {'topic': 'Kinetics', 'score': 90, 'totalQuestions': 10},
            ],
        },
    })
    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] is True
    assert len(body['weakSpots']) > 0
    # Thermodynamics should be the weakest (40% score → 60% error rate)
    top = body['weakSpots'][0]
    assert top['errorRate'] > 0
    assert top['severity'] in ('high', 'medium', 'low')


def test_weak_spots_with_flashcard_data(client):
    """Flashcard accuracy per topic is also factored in."""
    r = client.post('/progress/weak-spots', json={
        'progress': {
            'quizResults': [],
            'topics': {
                'Acids': {
                    'sessions': [{'cardsStudied': 10, 'incorrect': 8}],
                },
            },
        },
    })
    body = r.get_json()
    assert body['success'] is True
    assert len(body['weakSpots']) == 1
    assert body['weakSpots'][0]['topic'] == 'Acids'
    assert body['weakSpots'][0]['errorRate'] == 80


# ── POST /progress/study-plan ────────────────────────────────────────────────

def test_study_plan_no_exam_date(client):
    r = client.post('/progress/study-plan', json={})
    assert r.status_code == 400
    body = r.get_json()
    assert body['success'] is False


def test_study_plan_invalid_date(client):
    r = client.post('/progress/study-plan', json={'examDate': 'not-a-date'})
    assert r.status_code == 400


def test_study_plan_past_date(client):
    past = (date.today() - timedelta(days=5)).strftime('%Y-%m-%d')
    r = client.post('/progress/study-plan', json={'examDate': past})
    assert r.status_code == 400
    assert r.get_json()['error'] == 'Exam date is in the past'


def test_study_plan_today(client):
    today = date.today().strftime('%Y-%m-%d')
    r = client.post('/progress/study-plan', json={'examDate': today})
    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] is True
    assert body['daysLeft'] == 0
    assert len(body['days']) == 1
    assert body['days'][0]['label'] == 'Exam Day!'


def test_study_plan_future(client):
    future = (date.today() + timedelta(days=5)).strftime('%Y-%m-%d')
    r = client.post('/progress/study-plan', json={
        'examDate': future,
        'progress': {'topics': {'thermo': {}}},
        'weakSpots': [{'topic': 'Kinetics', 'severity': 'high'}],
    })
    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] is True
    assert body['daysLeft'] == 5
    assert len(body['days']) == 5
    # First day is 'Today'
    assert body['days'][0]['isToday'] is True
    assert body['days'][0]['label'] == 'Today'


# ── POST /progress/badges ────────────────────────────────────────────────────

def test_badges_empty(client):
    r = client.post('/progress/badges', json={'progress': {}})
    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] is True
    assert body['earnedCount'] == 0
    assert body['total'] == 18
    assert len(body['locked']) <= 6


def test_badges_earned(client):
    r = client.post('/progress/badges', json={
        'progress': {
            'totalQuestions': 1,
            'totalSessions': 1,
            'studyStreak': 7,
            'totalCards': 100,
            'totalCorrect': 82,
            'quizResults': [{'score': 75}],
            'totalStudyTime': 65,
        },
    })
    body = r.get_json()
    assert body['success'] is True
    earned_ids = [b['id'] for b in body['earned']]
    assert 'first_question' in earned_ids
    assert 'first_flashcard' in earned_ids
    assert 'streak_3' in earned_ids
    assert 'streak_7' in earned_ids
    assert 'accuracy_80' in earned_ids
    assert 'quiz_pass' in earned_ids
    assert 'study_hour' in earned_ids


# ── POST /progress/streak-check ──────────────────────────────────────────────

def test_streak_no_history(client):
    r = client.post('/progress/streak-check', json={})
    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] is True
    assert body['streak'] == 0
    assert body['status'] == 'no_history'


def test_streak_active_today(client):
    today_iso = date.today().isoformat() + 'T10:00:00Z'
    r = client.post('/progress/streak-check', json={
        'lastStudied': today_iso,
        'currentStreak': 5,
    })
    body = r.get_json()
    assert body['status'] == 'active_today'
    assert body['streak'] == 5


def test_streak_needs_activity(client):
    yesterday_iso = (date.today() - timedelta(days=1)).isoformat() + 'T10:00:00Z'
    r = client.post('/progress/streak-check', json={
        'lastStudied': yesterday_iso,
        'currentStreak': 3,
    })
    body = r.get_json()
    assert body['status'] == 'needs_activity'
    assert body['streak'] == 3


def test_streak_broken(client):
    old_iso = (date.today() - timedelta(days=5)).isoformat() + 'T10:00:00Z'
    r = client.post('/progress/streak-check', json={
        'lastStudied': old_iso,
        'currentStreak': 10,
    })
    body = r.get_json()
    assert body['status'] == 'broken'
    assert body['streak'] == 0


def test_streak_parse_error(client):
    r = client.post('/progress/streak-check', json={
        'lastStudied': 'not-a-date',
        'currentStreak': 2,
    })
    body = r.get_json()
    assert body['status'] == 'parse_error'
    assert body['streak'] == 2


# ── Blueprint registration ───────────────────────────────────────────────────

def test_progress_blueprints_registered(app):
    rules = [r.rule for r in app.url_map.iter_rules()]
    assert '/progress/readiness' in rules
    assert '/progress/weak-spots' in rules
    assert '/progress/study-plan' in rules
    assert '/progress/badges' in rules
    assert '/progress/streak-check' in rules
