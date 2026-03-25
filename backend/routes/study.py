"""
backend/routes/study.py — Study materials and quiz generation.

Endpoints
---------
POST /generate-study-materials
POST /generate-quiz
"""
from __future__ import annotations

import hashlib
import logging
import re

from flask import Blueprint, jsonify, request

from routes.shared import ctx
from routes.validation import validate_request
from routes.schemas import StudyMaterialsRequest, QuizRequest
from guest_limits import GuestLimitExceeded, guest_gate, enforce_exam_constraints_for_guest

logger = logging.getLogger(__name__)

study_bp = Blueprint('study', __name__)


@study_bp.route('/generate-study-materials', methods=['POST', 'OPTIONS'])
@validate_request(StudyMaterialsRequest)
def generate_study_materials():
    if request.method == 'OPTIONS':
        return jsonify({'ok': True})
    try:
        data = request.json
        try:
            guest_gate(request, 'studyplan', ctx.redis)
        except GuestLimitExceeded as _gle:
            return _gle.response()

        slides        = data.get('slides', [])
        material_type = data.get('type', 'notes')

        # Verify JWT and enforce daily limit
        from services.auth import _extract_verified_user
        verified_user_id, _tier = _extract_verified_user()

        from server import _cache_key, _cache_get, _cache_set
        from ai_router import route
        from services.ai import call_ai

        # ── Cache check ───────────────────────────────────────────────────────
        _sm_hash    = hashlib.md5(str(slides).encode()).hexdigest()[:16]
        _sm_cache_k = _cache_key('doc', _sm_hash, material_type, 0)
        _sm_cached  = _cache_get(_sm_cache_k)
        if _sm_cached:
            logger.info(f"⚡ Cache HIT study-materials: {material_type}")
            return jsonify({**_sm_cached, 'cached': True})

        if not slides:
            return jsonify({'success': False, 'error': 'No slide content provided'}), 400

        full_content = ""
        for slide in slides:
            title = slide.get('title', f"Slide {slide.get('slide_number', '?')}")
            content_lines = [l for l in slide.get('content', []) if l.strip()]
            notes = slide.get('notes', '').strip()
            if not content_lines and not notes:
                continue
            full_content += f"\n\n=== {title} ===\n"
            full_content += "\n".join(content_lines)
            if notes:
                full_content += f"\n[Speaker Notes: {notes}]"

        if not full_content.strip():
            return jsonify({'success': False, 'error': 'No readable content found in slides'}), 400

        char_limit = 24000
        content_for_ai = full_content.strip()[:char_limit]
        truncation_note = ""
        if len(full_content) > char_limit:
            truncation_note = (
                f"\n\n[NOTE: The slide content was trimmed to fit the model's context window. "
                f"The above represents the first {char_limit} characters. "
                f"Focus your output on what is provided — do not guess at omitted content.]"
            )
            content_for_ai += truncation_note

        if material_type == 'notes':
            prompt = f"""You are a meticulous academic note-taker. Below is the EXACT text extracted from a student's lecture slides.

YOUR TASK: Write comprehensive, well-organized study notes based STRICTLY on the content below.

RULES:
- Cover EVERY topic, concept, definition, formula, and example that appears in the slides
- Do NOT add information that is not in the slides
- Do NOT skip any slide or section
- Use clear headings that match the slide titles
- Preserve all technical terms, formulas, and specific details exactly as they appear
- If a slide has bullet points, expand them into full explanatory sentences
- Format: use markdown with ## for main sections, ### for subsections, and bullet points for lists

SLIDE CONTENT:
{content_for_ai}

Now write the complete study notes:"""

        elif material_type == 'reviewer':
            prompt = f"""You are a senior academic exam coach who has written board review books. Below is the EXACT text from a student's lecture slides.

YOUR TASK: Create a comprehensive, high-yield exam reviewer from this content. Be thorough and precise — students depend on this to pass their exams.

OUTPUT STRUCTURE (use these exact markdown headings):

## 📌 Topic Overview
Write 3–5 sentences summarizing the core theme of this material and what students are expected to master.

## 🔑 High-Yield Concepts
List every testable concept, definition, mechanism, and principle found in the slides. For each:
- **Term/Concept**: Clear, exam-ready definition or explanation
- Flag with ⚠️ anything that appears repeatedly or is emphasized in the slides (likely to be on the exam)

## 🧮 Formulas & Equations
List every formula, equation, or quantitative relationship in the slides. For each:
- Write it clearly with variable definitions
- Add a one-line note on when/how to apply it

## 📊 Key Values, Constants & Comparisons
Extract all specific numbers, thresholds, units, classifications, or comparative data.

## 🧠 Mnemonics & Memory Tips
Create 3–6 original mnemonics or memory hooks for the hardest-to-remember facts from the slides.

## ❓ Practice Questions (10 questions)
Write 10 exam-style questions directly from the slide content. Mix question types:
- 5 multiple choice (A/B/C/D with answer and explanation)
- 3 short-answer (with model answer)
- 2 "explain why" or "compare and contrast" style

For each MCQ:
Q: [question]
A) | B) | C) | D)
✅ Answer: [letter] — [1-sentence explanation referencing the slide content]

## 🚨 Common Mistakes to Avoid
List 3–5 common misconceptions or errors students make on this topic, based on what the slides emphasize.

## ⚡ Last-Minute Cheat Sheet
A condensed bullet list of the 10–15 most important facts to review the night before the exam.

RULES:
- Base EVERYTHING strictly on the provided slide content
- Do NOT fabricate, guess, or add external information
- If slides mention a specific number, value, or name — include it exactly
- Be as detailed as the content allows — do NOT be generic
- Use markdown formatting throughout

SLIDE CONTENT:
{content_for_ai}

Write the complete exam reviewer:"""

        elif material_type == 'flashcards':
            prompt = f"""You are a flashcard creator. Below is the EXACT text from lecture slides.

YOUR TASK: Create 15-20 flashcards based STRICTLY on this content.

FORMAT for each card:
CARD [N]
Q: [Question about a specific concept, term, or fact from the slides]
A: [Precise answer drawn directly from the slide content]

RULES:
- Every question must be answerable using the slide content provided
- Cover key terms, definitions, processes, formulas, and important facts
- Do NOT create questions about topics not in the slides

SLIDE CONTENT:
{content_for_ai}

Create the flashcards:"""

        elif material_type == 'summary':
            prompt = f"""You are a study guide writer. Below is the EXACT text from lecture slides.

YOUR TASK: Create a concise one-page summary sheet based STRICTLY on this content.

Include:
1. MAIN TOPIC & OVERVIEW (2-3 sentences)
2. KEY CONCEPTS & DEFINITIONS (from the slides only)
3. IMPORTANT FORMULAS/EQUATIONS (if any appear in the slides)
4. CRITICAL FACTS TO REMEMBER (the most testable points from the slides)

RULES:
- Only include what is in the slides
- Be concise but complete

SLIDE CONTENT:
{content_for_ai}

Write the summary sheet:"""

        elif material_type == 'quiz':
            prompt = f"""You are a quiz generator. Below is the EXACT text from lecture slides.

YOUR TASK: Generate exactly 10 multiple-choice questions based STRICTLY on this content.

STRICT FORMAT:
Q1. [Question text based on the slide content]
A) [option]
B) [option]
C) [option]
D) [option]
Answer: [correct letter]
Explanation: [brief explanation referencing the slide content]

RULES:
- All 10 questions must be directly answerable from the slide content provided
- Do NOT ask about topics not covered in the slides
- Only ONE correct answer per question

SLIDE CONTENT:
{content_for_ai}

Generate the quiz:"""

        elif material_type == 'all':
            prompt = f"""You are a comprehensive study material generator. Below is the EXACT text from lecture slides.

YOUR TASK: Generate ALL of the following based STRICTLY on this content:

1. STUDY NOTES - Comprehensive notes covering every topic in the slides
2. KEY FLASHCARDS - 10 Q&A cards for the most important concepts
3. SUMMARY SHEET - A concise overview of the main points
4. 5 PRACTICE QUESTIONS - Multiple choice questions from the slide content

RULES:
- Base EVERYTHING strictly on the provided slide content
- Do NOT add external information
- Label each section clearly

SLIDE CONTENT:
{content_for_ai}

Generate all study materials:"""

        else:
            prompt = f"""You are an academic assistant. Below is the EXACT text from lecture slides.

Create detailed {material_type} based STRICTLY on this content. Do not add information not present in the slides.

SLIDE CONTENT:
{content_for_ai}"""

        result = call_ai(prompt, system_prompt=(
            "You are an expert academic assistant and exam coach who creates precise, high-yield study materials. "
            "You ONLY use information from the provided source content — never fabricate or hallucinate. "
            "For exam reviewers, you think like a professor writing the exam: you identify what is most testable, "
            "what students most commonly get wrong, and what concepts are foundational vs peripheral. "
            "You write in a clear, structured format that students can scan quickly under exam pressure."
        ), model=route('study_plan', complexity=6), max_tokens_override=8000,
           endpoint='study_materials', user_id=verified_user_id)

        sm_payload = {'success': True, 'materials': {material_type: result}}
        _cache_set(_sm_cache_k, sm_payload)
        return jsonify(sm_payload)

    except Exception as e:
        logger.exception("Unhandled error")
        return jsonify({'success': False, 'error': str(e)}), 500


@study_bp.route('/generate-quiz', methods=['POST', 'OPTIONS'])
@validate_request(QuizRequest)
def generate_quiz():
    if request.method == 'OPTIONS':
        return jsonify({'ok': True})
    try:
        data = request.json or {}
        try:
            guest_gate(request, 'exam', ctx.redis)
            data = enforce_exam_constraints_for_guest(data)
        except GuestLimitExceeded as _gle:
            return _gle.response()

        slides             = data.get('slides', [])
        count              = max(5, min(50, int(data.get('count', 10))))
        difficulty         = data.get('difficulty', 'medium').lower().strip()
        quiz_mode          = data.get('mode', 'standard').lower().strip()
        existing_questions = data.get('existingQuestions', [])

        from services.auth import _extract_verified_user
        verified_user_id, _tier = _extract_verified_user()

        from ai_router import route
        from services.ai import call_ai
        from server import _parse_mcq

        if not slides:
            return jsonify({'success': False, 'error': 'No slide content provided'}), 400

        full_content = ""
        for slide in slides:
            title = slide.get('title', f"Slide {slide.get('slide_number','?')}")
            content_lines = [l for l in slide.get('content', []) if l.strip()]
            notes = slide.get('notes', '').strip()
            if not content_lines and not notes:
                continue
            full_content += f"\n\n=== {title} ===\n" + "\n".join(content_lines)
            if notes:
                full_content += f"\n[Notes: {notes}]"

        content_for_ai = full_content.strip()[:24000]
        if not content_for_ai:
            return jsonify({'success': False, 'error': 'No readable content in slides'}), 400

        difficulty_instructions = {
            'easy': (
                "DIFFICULTY: EASY\n"
                "- Test direct recall of terms, definitions, and basic facts stated explicitly in the slides\n"
                "- Questions should be clear and unambiguous — one obviously correct answer\n"
                "- Wrong options (distractors) should be clearly wrong but come from related topics in the slides\n"
                "- Bloom's Taxonomy: Knowledge/Remember level\n"
                "- Example question style: 'What is the definition of...', 'Which of the following is...', 'According to the slides, ...'"
            ),
            'medium': (
                "DIFFICULTY: MEDIUM\n"
                "- Test understanding and application of concepts from the slides\n"
                "- Questions should require the student to understand WHY, not just WHAT\n"
                "- Distractors should be plausible — common misunderstandings, closely related concepts, or partially correct statements\n"
                "- Include at least 2 application questions ('A student does X, what happens?')\n"
                "- Bloom's Taxonomy: Understand/Apply level\n"
                "- Example question style: 'Which best explains why...', 'If X occurs, what is the result...', 'What is the relationship between...'"
            ),
            'hard': (
                "DIFFICULTY: HARD\n"
                "- Test analysis, synthesis, and evaluation — the highest Bloom's levels\n"
                "- Questions should require integrating multiple concepts from across the slides\n"
                "- Distractors must be very close to the correct answer — they should be statements that are true in a DIFFERENT context or partially correct\n"
                "- Include at least 3 'EXCEPT' type questions (e.g., 'All of the following are true EXCEPT...')\n"
                "- Include comparison questions and 'what would happen if...' type scenarios\n"
                "- No question should be answerable by simple recall alone\n"
                "- Bloom's Taxonomy: Analyze/Evaluate/Create level"
            ),
        }
        diff_text = difficulty_instructions.get(difficulty, difficulty_instructions['medium'])

        no_repeat_block = ""
        if existing_questions:
            sample = existing_questions[:30]
            no_repeat_block = (
                "\n\nIMPORTANT — DO NOT REPEAT: The following question topics have already been used. "
                "Generate completely NEW questions on DIFFERENT aspects of the content:\n"
                + "\n".join(f"- {q}" for q in sample) + "\n"
            )

        if quiz_mode == 'situational':
            mode_instruction = (
                "\nQUIZ MODE: SITUATIONAL\n"
                "- Every question MUST open with a 2–4 sentence real-world scenario or case study\n"
                "- Scenarios should involve: a lab experiment, a patient/student/professional encountering this concept, "
                "a real-world application, or an observed phenomenon\n"
                "- The question should ask the student to diagnose, explain, predict, or decide based on the scenario\n"
                "- All 4 options must be plausible within the context of the scenario\n"
                "- The scenario should be rich enough that the wrong answer choices feel genuinely tempting\n"
                "- Never just restate a fact — always embed it in a realistic context"
            )
        else:
            mode_instruction = ""

        slide_count = len([s for s in slides if any(s.get('content', []))])
        coverage_note = ""
        if slide_count > 5:
            coverage_note = (
                f"\n\nCOVERAGE REQUIREMENT: The slide deck has {slide_count} slides with content. "
                f"Spread your {count} questions across the ENTIRE deck — do not concentrate them only on the first few slides. "
                "Aim to cover every major section."
            )

        prompt = f"""You are an expert exam writer who creates board-quality multiple choice questions for university students.
Below is the EXACT text from a student's lecture slides.

YOUR TASK: Generate exactly {count} multiple-choice questions based STRICTLY on this content.

{diff_text}{mode_instruction}{coverage_note}{no_repeat_block}

STRICT OUTPUT FORMAT — follow this exactly for every question, no deviations:
Q1. [Question text — write a complete, grammatically correct question]
A) [option — complete sentence or phrase, not just a word]
B) [option]
C) [option]
D) [option]
Answer: [single letter: A, B, C, or D]
Explanation: [3–5 sentences: (1) why the correct answer is right with specific evidence from the slides, (2) why the most tempting wrong answer is wrong, (3) a memory tip or key insight to help the student remember this for the exam]

QUALITY RULES:
- Every question must test a DIFFERENT concept — no two questions on the same fact
- All {count} questions must be answerable from the slide content below — no outside knowledge
- Only ONE correct answer per question — the other three must be clearly wrong (but tempting)
- Questions must be SPECIFIC — never ask vague questions like "Which is important?"
- Options must all be the same grammatical form and similar length
- Never start questions with "According to the slides" — write naturally
- Do NOT add headers, numbering schemes, or commentary — just Q1 through Q{count} in sequence
- Start immediately with Q1 — no preamble

SLIDE CONTENT:
{content_for_ai}

Generate the quiz:"""

        raw = call_ai(prompt, system_prompt=(
            "You are an expert exam writer with 20 years of experience creating board-level multiple choice questions. "
            "You write questions that genuinely test understanding, not just memorization. "
            "Your distractors are carefully crafted to catch common misconceptions. "
            "You strictly use only information from the provided source material — never add external knowledge. "
            "You always follow the exact output format with no deviations. "
            "You write thorough, educational explanations that help students learn from both correct and incorrect answers."
        ), model=route(
            'exam_hard'   if difficulty == 'hard'   else
            'exam_easy'   if difficulty == 'easy'   else
            'exam_medium',
            complexity=8 if difficulty == 'hard' else 4 if difficulty == 'easy' else 6
        ), max_tokens_override=12000, endpoint='quiz', user_id=verified_user_id)

        questions = _parse_mcq(raw)
        if not questions:
            return jsonify({'success': False, 'error': 'Could not parse quiz output. Try again.', 'raw': raw}), 500

        return jsonify({
            'success':    True,
            'questions':  questions,
            'count':      len(questions),
            'difficulty': difficulty,
            'raw':        raw
        })

    except Exception as e:
        logger.exception("Unhandled error")
        return jsonify({'success': False, 'error': str(e)}), 500
