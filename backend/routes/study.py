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

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.limiter import limiter
from routes.shared import ctx
from routes.schemas import StudyMaterialsRequest, QuizRequest
from services.guest_limits import enforce_exam_constraints_for_guest
from services.usage import enforce as _enforce_usage, UsageLimitExceeded as _UsageLimitExceeded
from services.auth import _extract_verified_user
from services.cache import cache_svc as _cache_svc

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post('/generate-study-materials')
@limiter.limit("20/minute")
def generate_study_materials(request: Request, body: StudyMaterialsRequest):
    try:
        data = body.model_dump()

        slides        = data.get('slides', [])
        material_type = data.get('type', 'notes')

        # ── Unified limit enforcement (guest + device + plan) ─────────────────
        verified_user_id, _tier, _is_exempt = _extract_verified_user(request)
        try:
            _enforce_usage(
                request,
                user_id=verified_user_id,
                tier=_tier,
                is_exempt=_is_exempt,
                guest_feature='studyplan',
                plan_feature='monthly_study_plans',
                redis_client=ctx.redis,
            )
        except _UsageLimitExceeded as _ule:
            return _ule.response()

        from services.ai_router import route
        from services.ai import call_ai

        # ── Cache check ───────────────────────────────────────────────────────
        _sm_hash    = hashlib.md5(str(slides).encode()).hexdigest()[:16]
        _sm_cache_k = _cache_svc.material_key('doc', _sm_hash, material_type, 0)
        _sm_cached  = _cache_svc.get('material', _sm_cache_k)
        if _sm_cached:
            logger.info(f"⚡ Cache HIT study-materials: {material_type}")
            return {**_sm_cached, 'cached': True}

        if not slides:
            return JSONResponse({'success': False, 'error': 'No slide content provided'}, status_code=400)

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
            return JSONResponse({'success': False, 'error': 'No readable content found in slides'}, status_code=400)

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
            prompt = (
                "You are a meticulous academic note-taker. Below is the EXACT text extracted from a student's lecture slides.\n\n"
                "YOUR TASK: Write comprehensive, well-organized study notes based STRICTLY on the content below.\n\n"
                "RULES:\n"
                "- Cover EVERY topic, concept, definition, formula, and example that appears in the slides\n"
                "- Do NOT add information that is not in the slides\n"
                "- Do NOT skip any slide or section\n"
                "- Use clear headings that match the slide titles\n"
                "- Preserve all technical terms, formulas, and specific details exactly as they appear\n"
                "- If a slide has bullet points, expand them into full explanatory sentences\n"
                "- Format: use markdown with ## for main sections, ### for subsections, and bullet points for lists\n\n"
                "SLIDE CONTENT:\n" + content_for_ai + "\n\nNow write the complete study notes:"
            )

        elif material_type == 'reviewer':
            prompt = (
                "You are a senior academic exam coach who has written board review books. Below is the EXACT text from a student's lecture slides.\n\n"
                "YOUR TASK: Create a comprehensive, high-yield exam reviewer from this content. Be thorough and precise — students depend on this to pass their exams.\n\n"
                "OUTPUT STRUCTURE (use these exact markdown headings):\n\n"
                "## 📌 Topic Overview\n"
                "Write 3–5 sentences summarizing the core theme of this material and what students are expected to master.\n\n"
                "## 🔑 High-Yield Concepts\n"
                "List every testable concept, definition, mechanism, and principle found in the slides. For each:\n"
                "- **Term/Concept**: Clear, exam-ready definition or explanation\n"
                "- Flag with ⚠️ anything that appears repeatedly or is emphasized in the slides (likely to be on the exam)\n\n"
                "## 🧮 Formulas & Equations\n"
                "List every formula, equation, or quantitative relationship in the slides. For each:\n"
                "- Write it clearly with variable definitions\n"
                "- Add a one-line note on when/how to apply it\n\n"
                "## 📊 Key Values, Constants & Comparisons\n"
                "Extract all specific numbers, thresholds, units, classifications, or comparative data.\n\n"
                "## 🧠 Mnemonics & Memory Tips\n"
                "Create 3–6 original mnemonics or memory hooks for the hardest-to-remember facts from the slides.\n\n"
                "## ❓ Practice Questions (10 questions)\n"
                "Write 10 exam-style questions directly from the slide content. Mix question types:\n"
                "- 5 multiple choice (A/B/C/D with answer and explanation)\n"
                "- 3 short-answer (with model answer)\n"
                "- 2 \"explain why\" or \"compare and contrast\" style\n\n"
                "For each MCQ:\n"
                "Q: [question]\n"
                "A) | B) | C) | D)\n"
                "✅ Answer: [letter] — [1-sentence explanation referencing the slide content]\n\n"
                "## 🚨 Common Mistakes to Avoid\n"
                "List 3–5 common misconceptions or errors students make on this topic, based on what the slides emphasize.\n\n"
                "## ⚡ Last-Minute Cheat Sheet\n"
                "A condensed bullet list of the 10–15 most important facts to review the night before the exam.\n\n"
                "RULES:\n"
                "- Base EVERYTHING strictly on the provided slide content\n"
                "- Do NOT fabricate, guess, or add external information\n"
                "- If slides mention a specific number, value, or name — include it exactly\n"
                "- Be as detailed as the content allows — do NOT be generic\n"
                "- Use markdown formatting throughout\n\n"
                "SLIDE CONTENT:\n" + content_for_ai + "\n\nWrite the complete exam reviewer:"
            )

        elif material_type == 'flashcards':
            prompt = (
                "You are a flashcard creator. Below is the EXACT text from lecture slides.\n\n"
                "YOUR TASK: Create 15-20 flashcards based STRICTLY on this content.\n\n"
                "FORMAT for each card:\n"
                "CARD [N]\n"
                "Q: [Question about a specific concept, term, or fact from the slides]\n"
                "A: [Precise answer drawn directly from the slide content]\n\n"
                "RULES:\n"
                "- Every question must be answerable using the slide content provided\n"
                "- Cover key terms, definitions, processes, formulas, and important facts\n"
                "- Do NOT create questions about topics not in the slides\n\n"
                "SLIDE CONTENT:\n" + content_for_ai + "\n\nCreate the flashcards:"
            )

        elif material_type == 'summary':
            prompt = (
                "You are a study guide writer. Below is the EXACT text from lecture slides.\n\n"
                "YOUR TASK: Create a concise one-page summary sheet based STRICTLY on this content.\n\n"
                "Include:\n"
                "1. MAIN TOPIC & OVERVIEW (2-3 sentences)\n"
                "2. KEY CONCEPTS & DEFINITIONS (from the slides only)\n"
                "3. IMPORTANT FORMULAS/EQUATIONS (if any appear in the slides)\n"
                "4. CRITICAL FACTS TO REMEMBER (the most testable points from the slides)\n\n"
                "RULES:\n"
                "- Only include what is in the slides\n"
                "- Be concise but complete\n\n"
                "SLIDE CONTENT:\n" + content_for_ai + "\n\nWrite the summary sheet:"
            )

        elif material_type == 'quiz':
            prompt = (
                "You are a quiz generator. Below is the EXACT text from lecture slides.\n\n"
                "YOUR TASK: Generate exactly 10 multiple-choice questions based STRICTLY on this content.\n\n"
                "STRICT FORMAT:\n"
                "Q1. [Question text based on the slide content]\n"
                "A) [option]\n"
                "B) [option]\n"
                "C) [option]\n"
                "D) [option]\n"
                "Answer: [correct letter]\n"
                "Explanation: [brief explanation referencing the slide content]\n\n"
                "RULES:\n"
                "- All 10 questions must be directly answerable from the slide content provided\n"
                "- Do NOT ask about topics not covered in the slides\n"
                "- Only ONE correct answer per question\n\n"
                "SLIDE CONTENT:\n" + content_for_ai + "\n\nGenerate the quiz:"
            )

        elif material_type == 'all':
            prompt = (
                "You are a comprehensive study material generator. Below is the EXACT text from lecture slides.\n\n"
                "YOUR TASK: Generate ALL of the following based STRICTLY on this content:\n\n"
                "1. STUDY NOTES - Comprehensive notes covering every topic in the slides\n"
                "2. KEY FLASHCARDS - 10 Q&A cards for the most important concepts\n"
                "3. SUMMARY SHEET - A concise overview of the main points\n"
                "4. 5 PRACTICE QUESTIONS - Multiple choice questions from the slide content\n\n"
                "RULES:\n"
                "- Base EVERYTHING strictly on the provided slide content\n"
                "- Do NOT add external information\n"
                "- Label each section clearly\n\n"
                "SLIDE CONTENT:\n" + content_for_ai + "\n\nGenerate all study materials:"
            )

        else:
            prompt = (
                f"You are an academic assistant. Below is the EXACT text from lecture slides.\n\n"
                f"Create detailed {material_type} based STRICTLY on this content. Do not add information not present in the slides.\n\n"
                "SLIDE CONTENT:\n" + content_for_ai
            )

        result = call_ai(prompt, system_prompt=(
            "You are an expert academic assistant and exam coach who creates precise, high-yield study materials. "
            "You ONLY use information from the provided source content — never fabricate or hallucinate. "
            "For exam reviewers, you think like a professor writing the exam: you identify what is most testable, "
            "what students most commonly get wrong, and what concepts are foundational vs peripheral. "
            "You write in a clear, structured format that students can scan quickly under exam pressure."
        ), model=route('study_plan', complexity=6), max_tokens_override=8000,
           endpoint='study_materials', user_id=verified_user_id)

        sm_payload = {'success': True, 'materials': {material_type: result}}
        _cache_svc.set('material', _sm_cache_k, sm_payload)
        return sm_payload

    except Exception as e:
        logger.exception("Unhandled error")
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)


@router.post('/generate-quiz')
@limiter.limit("30/minute")
def generate_quiz(request: Request, body: QuizRequest):
    try:
        data = body.model_dump()

        # ── Unified limit enforcement (guest + device + plan) ─────────────────
        verified_user_id, _tier, _is_exempt = _extract_verified_user(request)
        try:
            _enforce_usage(
                request,
                user_id=verified_user_id,
                tier=_tier,
                is_exempt=_is_exempt,
                guest_feature='exam',
                plan_feature='monthly_quizzes',
                redis_client=ctx.redis,
            )
        except _UsageLimitExceeded as _ule:
            return _ule.response()

        # Apply MCQ-only / max-5-question constraints for guest users
        data = enforce_exam_constraints_for_guest(request, data)

        slides             = data.get('slides', [])
        count              = max(5, min(50, int(data.get('count', 10))))
        difficulty         = data.get('difficulty', 'medium').lower().strip()
        quiz_mode          = data.get('mode', 'standard').lower().strip()
        question_type      = data.get('question_type', 'mcq').lower().strip()
        existing_questions = data.get('existingQuestions', [])

        from services.ai_router import route
        from services.ai import call_ai
        from services.mcq_parser import _parse_mcq

        if not slides:
            return JSONResponse({'success': False, 'error': 'No slide content provided'}, status_code=400)

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
            return JSONResponse({'success': False, 'error': 'No readable content in slides'}, status_code=400)

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

        # ── Question-type format instructions ─────────────────────────────
        # Types with special format rules get explicit instructions below.
        # mcq, situational, cbl, mixed, and openended use the default MCQ
        # output format (or mode_instruction above) and need no extra block.
        _VALID_QUESTION_TYPES = {
            'mcq', 'truefalse', 'fillinblank', 'matching',
            'situational', 'cbl', 'mixed', 'openended',
        }
        if question_type not in _VALID_QUESTION_TYPES:
            question_type = 'mcq'

        question_type_instructions = {
            'truefalse': (
                "\nQUESTION FORMAT: TRUE / FALSE\n"
                "- Each question is a clear statement that is either True or False\n"
                "- Options are exactly: A) True  B) False\n"
                "- Answer is A or B\n"
                "- Statements must be precise — avoid ambiguity\n"
                "- Mix true and false answers roughly equally\n"
                "- Use the same Q/A/Explanation output format as MCQ"
            ),
            'fillinblank': (
                "\nQUESTION FORMAT: FILL IN THE BLANK\n"
                "- Each question contains exactly one blank shown as ___\n"
                "- Provide 4 options labeled A-D that could fill the blank\n"
                "- Only one option correctly completes the statement\n"
                "- Distractors should be plausible terms from the same domain\n"
                "- Use the same Q/A/Explanation output format as MCQ"
            ),
            'matching': (
                "\nQUESTION FORMAT: MATCHING\n"
                "- Present a term or concept, then ask which description/definition matches it\n"
                "- Provide 4 options labeled A-D, each a possible match\n"
                "- Only one option is the correct match\n"
                "- Distractors should be real definitions/descriptions of related concepts\n"
                "- Use the same Q/A/Explanation output format as MCQ"
            ),
        }
        qtype_instruction = question_type_instructions.get(question_type, "")

        slide_count = len([s for s in slides if any(s.get('content', []))])
        coverage_note = ""
        if slide_count > 5:
            coverage_note = (
                f"\n\nCOVERAGE REQUIREMENT: The slide deck has {slide_count} slides with content. "
                f"Spread your {count} questions across the ENTIRE deck — do not concentrate them only on the first few slides. "
                "Aim to cover every major section."
            )

        prompt = (
            "You are an expert exam writer who creates board-quality multiple choice questions for university students.\n"
            "Below is the EXACT text from a student's lecture slides.\n\n"
            f"YOUR TASK: Generate exactly {count} multiple-choice questions based STRICTLY on this content.\n\n"
            f"{diff_text}{mode_instruction}{qtype_instruction}{coverage_note}{no_repeat_block}\n\n"
            "STRICT OUTPUT FORMAT — follow this exactly for every question, no deviations:\n"
            "Q1. [Question text — write a complete, grammatically correct question]\n"
            "A) [option — complete sentence or phrase, not just a word]\n"
            "B) [option]\n"
            "C) [option]\n"
            "D) [option]\n"
            "Answer: [single letter: A, B, C, or D]\n"
            "Explanation: [3–5 sentences: (1) why the correct answer is right with specific evidence from the slides, "
            "(2) why the most tempting wrong answer is wrong, (3) a memory tip or key insight to help the student remember this for the exam]\n\n"
            "QUALITY RULES:\n"
            "- Every question must test a DIFFERENT concept — no two questions on the same fact\n"
            f"- All {count} questions must be answerable from the slide content below — no outside knowledge\n"
            "- Only ONE correct answer per question — the other three must be clearly wrong (but tempting)\n"
            "- Questions must be SPECIFIC — never ask vague questions like \"Which is important?\"\n"
            "- Options must all be the same grammatical form and similar length\n"
            "- Never start questions with \"According to the slides\" — write naturally\n"
            f"- Do NOT add headers, numbering schemes, or commentary — just Q1 through Q{count} in sequence\n"
            "- Start immediately with Q1 — no preamble\n"
            "- Do NOT use any markdown formatting (no **, *, _, ` or other symbols) — plain text only\n\n"
            "SLIDE CONTENT:\n"
            + content_for_ai + "\n\nGenerate the quiz:"
        )

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
            return JSONResponse({'success': False, 'error': 'Could not parse quiz output. Try again.', 'raw': raw}, status_code=500)

        return {
            'success':    True,
            'questions':  questions,
            'count':      len(questions),
            'difficulty': difficulty,
            'raw':        raw
        }

    except Exception as e:
        logger.exception("Unhandled error")
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)
