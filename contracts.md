# Chunks AI — Frontend/Backend API Contract

> **Purpose:** Single source of truth for every endpoint the `chunks-v2` frontend calls.  
> **CI target (Phase 4-B):** A script will diff the TypeScript request types against the Pydantic schemas and fail the build on drift.  
> **Last audited:** 2026-04-17

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Frontend and backend types are fully aligned |
| ⚠️ | Minor drift — field present on one side only, or optional vs required mismatch |
| ❌ | Breaking mismatch — field names or types do not agree |
| 🔧 | Previously broken, now resolved |

---

## Endpoint Table

### POST `/ask`

| | Frontend (`studyApi.ts` → `types/api.ts`) | Backend (`routes/chat.py` via `schemas.AskRequest`) |
|---|---|---|
| **TS request type** | `SendMessageRequest` | — |
| **Pydantic schema** | — | `AskRequest (_LenientBase)` |
| `question` | `string` (required) | `str = ""` |
| `complexity` | `number?` (default 3) | `int = Field(3, ge=1, le=10)` |
| `mode` | `string?` (default `'study'`) | `str = "study"` |
| `thinking` | `string \| null \| undefined` | `Optional[str] = None` |
| `history` | `MessageHistoryItem[]?` (default `[]`) | `List[Any] = []` |
| `selected_text` | `string?` (default `''`) | `str = ""` |
| `doc_context` | `string?` (default `''`) | `str = ""` |
| `user_memory` | `string?` (default `''`) | `str = ""` |
| `bookId` | `string?` | `Optional[str] = None` |
| `student_profile` | `string?` | `str = ""` |
| `stream` | sent as `true` in `sendMessageStream` | not in schema (ignored via `_LenientBase`) |
| `web_search` | not sent | `bool = False` |
| `task_type` | not sent | `Optional[str] = None` |
| **TS response type** | `SendMessageResponse` | `AskResponse` |
| `success` | `boolean` | `bool` |
| `answer` | `string` | `str = ""` |
| `mode` | `string` | `str = ""` |
| `cached?` | `boolean?` | extra allowed |
| **Frontend caller** | `studyApi.ts:158` (`sendMessage`), `studyApi.ts:207` (`sendMessageStream`) | |
| **Backend handler** | | `routes/chat.py → ask()` |
| **Status** | ✅ | `bookId` casing matches on both sides. `stream`, `web_search`, `task_type` are backend-only extras; `_LenientBase` accepts unknown fields. |

---

### POST `/generate-study-materials`

| | Frontend (`studyApi.ts` → `types/api.ts`) | Backend (`routes/study.py` via `schemas.StudyMaterialsRequest`) |
|---|---|---|
| **TS request type** | `GenerateStudyMaterialsRequest` | — |
| **Pydantic schema** | — | `StudyMaterialsRequest (_LenientBase)` |
| `slides` | `SlideItem[]` (required) | `List[SlideItem] = []` |
| `type` | `'notes' \| 'reviewer' \| 'flashcards' \| 'summary' \| 'quiz' \| 'all'` | `str = "notes"` |
| `bookId` | `string?` | **not declared** (ignored via `_LenientBase`) |
| **TS response type** | `GenerateStudyMaterialsResponse` | `StudyMaterialsResponse` |
| `success` | `boolean` | `bool` |
| `materials` | `Record<string, string>` | `Dict[str, Any]` |
| **Frontend caller** | `studyApi.ts:349` (`generateStudyMaterials`) | |
| **Backend handler** | | `routes/study.py → generate_study_materials()` |
| **Status** | ⚠️ | `bookId` is sent by frontend but the backend schema doesn't declare it (extra is allowed but the field is silently ignored — backend never uses it). `type` is typed as a union on the frontend but treated as a bare `str` on the backend. |

---

### POST `/generate-quiz`

| | Frontend (`studyApi.ts` → `types/api.ts`) | Backend (`routes/study.py` via `schemas.QuizRequest`) |
|---|---|---|
| **TS request type** | `GenerateQuizRequest` | — |
| **Pydantic schema** | — | `QuizRequest (_LenientBase)` |
| `slides` | `SlideItem[]` (required) | `List[SlideItem] = []` |
| `count` | `number?` (default 10) | `int = Field(10, ge=5, le=50)` |
| `difficulty` | `'easy' \| 'medium' \| 'hard'?` (default `'medium'`) | `str = "medium"` |
| `mode` | `string?` (default `'standard'`) | `str = "standard"` |
| `question_type` | `string?` (default `'mcq'`) | `str = "mcq"` |
| `existingQuestions` | `string[]?` (default `[]`) | `List[str] = []` (**camelCase matches**) |
| `bookId` | `string?` | **not declared** (ignored via `_LenientBase`) |
| **TS response type** | `GenerateQuizResponse` | `QuizResponse` |
| `success` | `boolean` | `bool` |
| `questions` | `QuizQuestion[]` | `List[QuizQuestionItem]` |
| `count` | `number` | `int = 0` |
| `difficulty` | `string` | `str = ""` |
| **Frontend caller** | `studyApi.ts:327` (`generateQuiz`) | |
| **Backend handler** | | `routes/study.py → generate_quiz()` |
| **Status** | ⚠️ | `bookId` is sent but silently ignored — backend `QuizRequest` has no `bookId` field (the field is accepted by `_LenientBase` but the handler never reads it). `existingQuestions` casing matches. |

---

### POST `/generate-flashcards`

| | Frontend (`studyApi.ts` → `types/api.ts`) | Backend (`routes/flashcards.py` via `schemas.FlashcardsRequest`) |
|---|---|---|
| **TS request type** | `GenerateFlashcardsRequest` | — |
| **Pydantic schema** | — | `FlashcardsRequest (_LenientBase)` |
| `topic` | `string` (required) | `str = "chemistry"` |
| `count` | `number?` (default 10) | `int = Field(10, ge=1, le=20)` |
| `bookId` | `string?` | `Optional[str] = None` (**camelCase matches**) |
| **TS response type** | `GenerateFlashcardsResponse` | `FlashcardsResponse` |
| `success` | `boolean` | `bool` |
| `flashcards` | `Flashcard[]` (`{front, back, hint?}`) | `List[FlashcardItem]` (`{front, back}`) — `hint` added by handler but not in Pydantic model |
| `count` | `number` | `int = 0` |
| `topic` | `string` | `str = ""` |
| **Frontend caller** | `studyApi.ts:315` (`generateFlashcards`) | |
| **Backend handler** | | `routes/flashcards.py → generate_flashcards()` |
| **Status** | ✅ | `bookId` casing matches on both sides. `hint` field is generated by the handler and appended to the dict; `FlashcardsResponse` Pydantic model doesn't declare it but `extra="allow"` passes it through. |

---

### GET `/get-library`

| | Frontend (`studyApi.ts`) | Backend (`routes/library.py`) |
|---|---|---|
| **Request** | No body (GET) | No body |
| `Authorization` header | `Bearer <token>` | validated by `_extract_verified_user` |
| **TS response type** | `LibraryResponse` (`{ books: LibraryBookRaw[] }`) | `{ success: bool, books: list }` |
| `books[].id` | `string` | `str` (book dict key) |
| `books[].name` | `string` | `str` |
| `books[].author` | `string?` | `str` |
| `books[].available` | `boolean?` | hardcoded `True` |
| **Frontend caller** | `studyApi.ts:368` (`fetchLibrary`) | |
| **Backend handler** | | `routes/library.py → get_library()` |
| **Status** | ⚠️ | Frontend `LibraryResponse` doesn't have a top-level `success` field but backend always includes it. Frontend ignores it, so no runtime break. |

---

### POST `/load-book`

| | Frontend (`studyApi.ts`) | Backend (`routes/library.py` via `schemas.LoadBookRequest`) |
|---|---|---|
| **TS request** | `{ bookId: string }` | `LoadBookRequest (_LenientBase)` |
| `bookId` | `string` (required) | `str` (required) — **camelCase matches** |
| **TS response type** | `void` (result discarded) | `LoadBookResponse` |
| `success` | — (ignored) | `bool` |
| `book_id` | — (ignored) | `str` |
| `book_name` | — (ignored) | `str` |
| `author` | — (ignored) | `str` |
| `chunks_count` | — (ignored) | `int` |
| **Frontend caller** | `studyApi.ts:372` (`loadBook`) | |
| **Backend handler** | | `routes/library.py → load_book()` |
| **Status** | ✅ | `bookId` casing matches. Response is not consumed by the frontend. |

---

### GET `/books/{bookId}/pdf`

| | Frontend (`studyApi.ts`) | Backend (`routes/library.py`) |
|---|---|---|
| **Request** | path param `bookId` | path param `book_id` (FastAPI alias) |
| **Response** | `Blob` (streamed PDF) | `StreamingResponse(media_type='application/pdf')` |
| **Frontend caller** | `studyApi.ts:381` (`fetchBookPdf`) | |
| **Backend handler** | | `routes/library.py → serve_pdf()` |
| **Legacy redirect** | — | `GET /pdf/{book_id}` → 301 to `/books/{book_id}/pdf` |
| **Status** | 🔧 | Previously the frontend called `/pdf/{bookId}` (old route). Fixed in Phase 1 — frontend now calls `/books/{bookId}/pdf` directly. Route is live and returns a streaming PDF blob. |

---

### POST `/upload-document`

| | Frontend (`studyApi.ts`) | Backend (`routes/upload.py`) |
|---|---|---|
| **Request content-type** | `multipart/form-data` (FormData, no explicit Content-Type header — browser sets boundary) | `UploadFile = File(default=None)` |
| **Form field** | `file` | `file: UploadFile` |
| **TS response type** | `UploadDocumentResponse` | handler dict |
| `success` | `boolean` | `bool` |
| `slides` | `SlideItem[]` | `List[dict]` |
| `total_slides` | `number` | `int` |
| `filename` | `string` | `str` (sanitised via `secure_filename`) |
| `bookId` | `string?` | `bookId: str` (**camelCase matches**) |
| **Side effect** | — | Spawns background thread to build PAEV index; sets `paev_ready:{bookId}` in Redis when done |
| **Frontend caller** | `studyApi.ts:490` (`uploadDocument`) | |
| **Backend handler** | | `routes/upload.py → upload_document()` |
| **Status** | ✅ | `bookId` casing matches. After upload the frontend dispatches `SET_BOOK` to store `bookId` in `StudyContext` so subsequent calls to `/ask`, `/generate-quiz`, and `/generate-flashcards` include it. |

---

### GET `/tutor/load-model`

| | Frontend (`studyApi.ts`) | Backend (`routes/tutor_brain.py`) |
|---|---|---|
| **Request** | Query param `user_id` (URL-encoded) | reads from JWT via `_extract_verified_user(request)` — **ignores `user_id` query param** |
| `user_id` | sent as `?user_id=<uid>` | **ignored** — user identity comes from JWT |
| **TS response type** | `LoadTutorModelResponse` (`{ student_model: TutorStudentModel \| null }`) | `{ student_model: dict \| None }` |
| `student_model.mastered` | `string[]` | `list` |
| `student_model.gaps` | `Array<{ concept, status, failedAt, lastSeenAt, passCount }>` | freeform `dict` stored as JSONB |
| `student_model.quizHistory` | `Array<{ topic, score, wrongAnswers, timestamp }>` | freeform `dict` stored as JSONB |
| **Frontend caller** | `studyApi.ts:421` (`loadTutorModel`) | |
| **Backend handler** | | `routes/tutor_brain.py → load_model()` |
| **Status** | ⚠️ | The frontend sends `?user_id=<uid>` but the backend derives user identity exclusively from the JWT Bearer token (the query param is never read). This is harmless but the query param is noise. `student_model` structure is not Pydantic-validated on the way out — shape correctness depends on what was saved. |

---

### POST `/tutor/save-model`

| | Frontend (`studyApi.ts`) | Backend (`routes/tutor_brain.py` via `SaveModelRequest`) |
|---|---|---|
| **TS request** | `{ user_id: string, student_model: TutorStudentModel }` | `SaveModelRequest` |
| `user_id` | `string` | **not in `SaveModelRequest`** — backend reads user from JWT; `user_id` in body is not declared (ignored via default Pydantic behaviour; `SaveModelRequest` uses strict base) |
| `student_model` | `TutorStudentModel` | `dict` |
| `student_model.mastered` | `string[]` | validated: `isinstance(model.get('mastered'), list)` |
| `student_model.gaps` | array | validated: `isinstance(model.get('gaps'), list)` |
| `student_model.quizHistory` | array | validated: `isinstance(model.get('quizHistory'), list)` — **camelCase matches** |
| **TS response type** | `void` | `{ success: True }` |
| **Frontend caller** | `studyApi.ts:428` (`saveTutorModel`) | |
| **Backend handler** | | `routes/tutor_brain.py → save_model()` |
| **Status** | ⚠️ | `user_id` is sent in the request body but silently ignored by the backend (identity comes from JWT). `SaveModelRequest` uses bare `BaseModel` (not `_LenientBase`), so `user_id` in the body would be rejected if `extra="forbid"` were set — it currently defaults to `extra="ignore"`. `quizHistory` casing matches. |

---

### GET `/tutor/paev-status`

| | Frontend (`studyApi.ts`) | Backend (`routes/tutor_brain.py`) |
|---|---|---|
| **Request** | Query param `book_id` (URL-encoded) | Query param `book_id: str` |
| `book_id` | `string` (**snake_case**) | `str` (**snake_case** — matches) |
| **TS response type** | `{ ready: boolean }` | `{ ready: True \| False }` |
| `ready` | `boolean` | `bool` |
| **Frontend caller** | `studyApi.ts:562` (`checkPaevStatus`) | |
| **Backend handler** | | `routes/tutor_brain.py → paev_status()` |
| **Status** | ✅ | `book_id` is consistently snake_case on both sides. Redis key pattern `paev_ready:{book_id}` set by `routes/upload.py` background thread. |

---

### POST `/api/admin/verify-access`

| | Frontend | Backend (`routes/admin.py` via `schemas.AdminVerifyRequest`) |
|---|---|---|
| **Caller** | **Not called from `studyApi.ts`** — admin-panel only | `AdminVerifyRequest (_LenientBase)` |
| `pin` | `string?` | `Optional[str] = None` |
| **Frontend caller** | None in `chunks-v2` | |
| **Backend handler** | | `routes/admin.py → verify_access()` |
| **Status** | ✅ | Not part of the student-facing API. Admin UI calls this directly. No contract drift possible from `studyApi.ts`. |

---

## Additional Tutor Endpoints (called from `studyApi.ts`)

### POST `/tutor/analyze-gaps`

| Field | Frontend | Backend (`tutor_brain.AnalyzeGapsRequest`) | Status |
|---|---|---|---|
| `book_id` | `string` (**snake_case**) | `str` (**snake_case**) | ✅ |
| `quiz_results[].topic` | `string` | `str` | ✅ |
| `quiz_results[].score` | `number` (0–100) | `float` | ✅ |
| `quiz_results[].wrongAnswers` | `string[]` (**camelCase**) | `list[str] = []` (**camelCase** — matches) | ✅ |
| `known_concepts` | `string[]` (**snake_case**) | `list[str] = []` (**snake_case**) | ✅ |

**Frontend caller:** `studyApi.ts:459` (`analyzeGaps`)  
**Backend handler:** `routes/tutor_brain.py → analyze_gaps()`  
**Status:** ✅

---

### POST `/tutor/evaluate-socratic`

| Field | Frontend | Backend (`tutor_brain.EvaluateSocraticRequest`) | Status |
|---|---|---|---|
| `question` | `string` | `str` | ✅ |
| `student_answer` | `string` (**snake_case**) | `str` (**snake_case**) | ✅ |
| `topic` | `string` | `str = ''` | ✅ |

**Frontend caller:** `studyApi.ts:476` (`evaluateSocraticAnswer`)  
**Backend handler:** `routes/tutor_brain.py → evaluate_socratic()`  
**Status:** ✅

---

### POST `/tutor/next-topic`

| Field | Frontend | Backend (`tutor_brain.NextTopicRequest`) | Status |
|---|---|---|---|
| `book_id` | `string` (**snake_case**) | `str` | ✅ |
| `current_page` | `number` (default 0) | `int = 0` | ✅ |
| `student_gaps[].concept` | `string` | `str` | ✅ |
| `student_gaps[].status` | `string` | `str` | ✅ |

**Frontend caller:** `studyApi.ts:540` (`fetchNextTopic`)  
**Backend handler:** `routes/tutor_brain.py → next_topic()`  
**Status:** ✅

---

## Known Issues Summary

| Endpoint | Issue | Severity |
|---|---|---|
| `POST /generate-study-materials` | `bookId` sent by frontend but backend schema (`StudyMaterialsRequest`) has no `bookId` field — silently ignored. Backend never uses book context for study-material generation. | ⚠️ Medium |
| `POST /generate-quiz` | `bookId` sent by frontend but backend schema (`QuizRequest`) has no `bookId` field — silently ignored. Backend never uses book context for quiz generation. | ⚠️ Medium |
| `GET /tutor/load-model` | Frontend sends `?user_id=<uid>` query param but backend ignores it (uses JWT). Param is harmless noise. | ⚠️ Low |
| `POST /tutor/save-model` | Frontend sends `user_id` in body but backend ignores it (uses JWT). `SaveModelRequest` doesn't declare `user_id`. | ⚠️ Low |
| `GET /get-library` | Backend response includes `success: true` top-level field; `LibraryResponse` TS type doesn't model it. Not a runtime break. | ⚠️ Low |

---

## Resolved Issues

| Endpoint | Issue | Resolution |
|---|---|---|
| `GET /books/{bookId}/pdf` | Frontend was calling legacy `/pdf/{bookId}` route which returned HTML (redirected) instead of the PDF blob. | 🔧 Fixed in Phase 1 — frontend now calls `/books/{bookId}/pdf` directly. 301 redirect from `/pdf/{bookId}` preserved for backward compat. |
| `POST /upload-document` response `bookId` | `bookId` returned in upload response was never stored in context or threaded to subsequent `/ask`, `/generate-quiz`, or `/tutor/*` calls. | 🔧 Fixed — `StudyContext` now dispatches `SET_BOOK` after upload; `bookId` is stored in state, persisted to localStorage, and included in `sendMessage`, `generateFlashcards`, and `generateQuiz` calls. |
| `POST /generate-quiz` missing `bookId` in type | `GenerateQuizRequest` TS type had no `bookId` field and `handleGenerateQuiz` didn't pass it. | 🔧 Fixed — `bookId?: string` added to `GenerateQuizRequest`; `handleGenerateQuiz` now passes `bookId: stateRef.current.bookId`. |
| `POST /generate-study-materials` missing `bookId` in type | `GenerateStudyMaterialsRequest` TS type had no `bookId` field. | 🔧 Fixed — `bookId?: string` added to `GenerateStudyMaterialsRequest`. |
