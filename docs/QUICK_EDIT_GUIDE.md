# ⚡ Chunks AI — Complete Quick Edit Guide

A file-level reference for every page and every feature. Find what you want to change, then go straight to the right file.

---

## 🏠 HOME PAGE (`/home`)

| "I want to change…" | Edit this file |
|---|---|
| Page layout / HTML structure | `src/screens/HomeScreen.js` |
| Hero, search bar, welcome text | `src/screens/HomeScreen.js` (WELCOME_HTML constant) |
| Sending a chat message | `src/screens/HomeScreen.js` → `homeSendMessage()` |
| AI response rendering (typewriter) | `src/screens/HomeScreen.js` → `homeAppendAI()` + `src/utils/typewriter.js` |
| Chat action buttons (Copy, Thumb, Retry) | `src/screens/HomeScreen.js` → `homeAppendAI()` |
| Chat input bar (textarea, attach, think) | `src/components/ChatBar/ChatBar.js` |
| Auto thinking mode logic | `src/utils/questionClassifier.js` |
| Image paste / attach in home chat | `src/state/workspace/attachments.js` |
| Image sending (`/ask-image`) | `src/screens/HomeScreen.js` → `homeSendMessage()` |
| Recent activity cards on landing | `src/screens/HomeScreen.js` → `_renderHomeActivities()` |
| Realtime message sync | `src/state/home/homeMessagesRealtime.js` |
| Backend AI call | `backend/routes/chat.py` → `POST /ask` |
| Backend image/vision call | `backend/routes/image.py` → `POST /ask-image` |
| Styles | `src/styles/screens/home.css` |

---

## 💬 WORKSPACE PAGE (`/workspace`)

| "I want to change…" | Edit this file |
|---|---|
| Page layout / HTML structure | `src/screens/WorkspaceScreen.js` |
| PDF viewer rendering | `src/state/workspace/pdf.js` |
| PDF zoom, page navigation | `src/state/workspace/pdf.js` (`wsZoomIn`, `wsNextPage`, etc.) |
| Book selection (sidebar) | `src/state/workspace/books.js` → `selectBook()` |
| User-uploaded document handling | `src/state/workspace/userDocs.js` → `selectUserDoc()` |
| Chat send / AI request | `src/state/workspace/chat.js` → `_wsAsk()`, `wsChatSend()` |
| Chat message rendering (Markdown+KaTeX) | `src/state/workspace/chat.js` → `_wsRenderMessageFromBlocks()` |
| Chat action buttons (Copy, Thumb, Retry) | `src/state/workspace/chat.js` → `_wsRenderMessageFromBlocks()` |
| Chat history (session restore) | `src/state/workspace/chat.js` → `_wsRenderHistory()` |
| Thinking mode toggle | `src/state/workspace/chat.js` → `wsToggleThinking()` |
| Web search toggle | `src/state/workspace/chat.js` → `wsToggleWebSearch()` |
| Stop generation button | `src/state/workspace/chat.js` → `wsStopGeneration()` |
| Smart suggestions | `src/state/workspace/chat.js` → `refreshSmartSuggestions()` |
| PDF outline sidebar | `src/state/workspace/outline.js` |
| Text selection → Ask button | `src/state/workspace/selection.js` |
| File attach / image attach | `src/state/workspace/attachments.js` |
| YouTube ingest | `src/state/workspace/youtube.js` |
| Voice input / read-aloud | `src/state/workspace/voice.js` |
| Smart Notes panel (Preact) | `src/components/SmartNotesPanel.jsx` |
| Sticky notes strip (Preact) | `src/components/SmartNotesPanel.jsx` |
| Canvas panel (Preact) | `src/components/CanvasPanel.jsx` |
| Chat input bar component | `src/components/ChatBar/ChatBar.js` |
| Realtime chat sync (Supabase) | `src/state/workspace/chatRealtime.js` |
| Shared mutable state object (`ws`) | `src/state/workspace/state.js` |
| All window.* bridges for workspace | `src/globals.js` |
| Backend AI call | `backend/routes/chat.py` → `POST /ask` |
| Backend image/vision call | `backend/routes/image.py` → `POST /ask-image` |
| Backend book content / vector search | `backend/services/books.py` + `backend/services/vector_store.py` |
| Styles | `src/styles/screens/workspace.css` |
| Mobile workspace toggle | `src/screens/WorkspaceScreen.js` → `wsMobileView()` |

---

## 📚 LIBRARY PAGE (`/library`)

| "I want to change…" | Edit this file |
|---|---|
| Page layout / HTML structure | `src/screens/LibraryScreen.js` |
| Library book list rendering | `src/state/workspace/library.js` → `filterLibrary()` |
| Library search/filter | `src/state/workspace/library.js` → `filterLibSection()` |
| Library modal (popup picker) | `src/components/LibraryModal.js` |
| Book metadata (title, author, cover) | `src/state/workspace/state.js` → `wsBookMeta` |
| Backend book list | `backend/routes/library.py` → `GET /get-library` |
| Progress tracking per book | `src/lib/bookProgress.js` |
| Library progress badges | `src/screens/LibraryScreen.js` → `_libInjectProgress()` |
| Styles | `src/styles/screens/library.css` + `src/screens/library.css` |

---

## 🃏 FLASHCARD PAGE (`/flashcard`)

| "I want to change…" | Edit this file |
|---|---|
| Page layout / HTML structure | `src/screens/FlashScreen.js` |
| Topic generation bar logic | `src/state/flash/generation.js` → `_fcGenerateFromBar()` |
| PDF/PPTX/DOCX upload → cards | `src/state/flash/generation.js` → `_fcProcessUploadedFile()` |
| Deck list rendering (grid) | `src/state/flash/decks.js` → `_fcRenderDeckList()` |
| Start / load a deck | `src/state/flash/decks.js` + `src/state/flash/session.js` |
| Card rendering (front/back) | `src/state/flash/session.js` → `_fcRenderCard()` |
| Flip animation | `src/state/flash/session.js` → `_fcFlip()` |
| Rate card (easy/ok/hard) + advance | `src/state/flash/session.js` → `_fcAdvance()` |
| AI tutor hint on hard card | `src/state/flash/session.js` → `_fcShowTutor()` |
| Session end / complete modal | `src/state/flash/completion.js` → `_fcFinishSession()` |
| Restart / study hard only | `src/state/flash/completion.js` |
| Streak counter + XP | `src/state/flash/streak.js` |
| Freeze token logic | `src/state/flash/streak.js` → `_fcTryUseFreeze()` |
| Visual accent/theme picker | `src/state/flash/accent.js` |
| Keyboard shortcuts (space=flip) | `src/state/flash/keyboard.js` |
| Edit a card inline | `src/state/flash/editing.js` |
| Delete a deck | `src/state/flash/decks.js` → `_fcDeleteDeck()` |
| Mastery % per deck | `src/state/flash/decks.js` → `_fcSaveMastery()` |
| "Make flashcard" button in workspace chat | `src/state/flash/chatBridge.js` → `wsMakeFlashcard()` |
| Navigate from workspace → flash | `src/state/flash/chatBridge.js` → `wsOpenFlashcardDeck()` |
| Shared state object (`fc`) | `src/state/flash/state.js` |
| All persistence (Supabase + localStorage) | `src/lib/flashcardDb.js` |
| Realtime sync (Supabase channel) | `src/state/flash/flashcardRealtime.js` |
| All window.* bridges for flash | `src/globals.js` |
| Backend AI generation endpoint | `backend/routes/flashcards.py` → `POST /generate-flashcards` |
| Backend study materials (PDF path) | `backend/routes/study.py` → `POST /generate-study-materials` |
| Backend file upload (PDF text extract) | `backend/routes/upload.py` → `POST /upload-document` |
| Spaced repetition (SM-2) algorithm | `src/lib/flashcardDb.js` → `fcRatingToSRS()` |
| Styles | `src/styles/screens/flash.css` |

---

## 📝 EXAM PAGE (`/exam`)

| "I want to change…" | Edit this file |
|---|---|
| Page layout / HTML structure | `src/screens/ExamScreen.js` |
| Exam setup screen (topic, type, count) | `src/screens/ExamScreen.js` |
| Question rendering (MCQ / free-response) | `src/screens/ExamScreen.js` |
| Exam generation API call | `backend/routes/study.py` → `POST /generate-quiz` |
| MCQ parsing | `backend/services/mcq_parser.py` |
| Guest exam constraints (MCQ-only, max 5) | `backend/guest_limits.py` + `src/screens/ExamScreen.js` → `enforceExamConstraints()` |
| Exam history / results | `src/lib/examDb.js` |
| Styles | `src/styles/screens/exam.css` |

---

## 📅 STUDY PLAN PAGE (`/studyplan`)

| "I want to change…" | Edit this file |
|---|---|
| Page layout / HTML structure | `src/screens/StudyPlanScreen.js` |
| Plan generation (topic, schedule) | `src/state/studyplan/generation.js` |
| Plan rendering (calendar, cards) | `src/state/studyplan/rendering.js` + `src/state/studyplan/calendar.js` |
| Daily task / mastery panel | `src/state/studyplan/panel.js` |
| Built-in exam within study plan | `src/state/studyplan/exam.js` |
| Built-in flashcards within study plan | `src/state/studyplan/flashcards.js` |
| Built-in visual tutor within study plan | `src/state/studyplan/visualTutor.js` |
| Practice questions | `src/state/studyplan/practiceQuestions.js` |
| Explain section | `src/state/studyplan/explain.js` |
| Plan input handling | `src/state/studyplan/input.js` |
| SRS within study plan | `src/state/studyplan/srs.js` |
| Mastery tracking | `src/state/studyplan/mastery.js` |
| Notifications | `src/state/studyplan/notifications.js` |
| Plan library (saved plans) | `src/state/studyplan/planLibrary.js` |
| Workspace bridge (open in workspace) | `src/state/studyplan/workspaceBridge.js` |
| Shared state | `src/state/studyplan/state.js` |
| DOM patches (fix library modal etc.) | `src/state/studyplan/patches.js` |
| Backend API call | `backend/routes/study.py` → `POST /generate-study-materials` |
| Styles | `src/styles/screens/studyplan.css` + `studyplan-exam.css` + `studyplan-drawer.css` |

---

## 🔬 RESEARCH PAGE (`/research`)

| "I want to change…" | Edit this file |
|---|---|
| Page layout / HTML structure | `src/screens/ResearchScreen.js` |
| Research setup / topic input | `src/screens/ResearchScreen.js` → `_researchBackToSetup()` |
| Research AI chat/streaming | `src/screens/ResearchScreen.js` → `_showResearchView()` |
| Web search toggle (always on) | `backend/routes/chat.py` (web_search=true flag) |
| Backend AI call | `backend/routes/chat.py` → `POST /ask` with `web_search: true` |
| Styles | `src/styles/screens/research.css` |

---

## 🖼️ VISUAL TUTOR PAGE (`/visualtutor`)

| "I want to change…" | Edit this file |
|---|---|
| Page layout / HTML structure | `src/screens/VisualTutorScreen.js` |
| Clear/reset visual session | `src/screens/VisualTutorScreen.js` → `_vtClear()` |
| Image upload + AI explanation | `src/screens/VisualTutorScreen.js` |
| Backend vision call | `backend/routes/image.py` → `POST /ask-image` |
| Styles | `src/styles/screens/visual-tutor.css` |

---

## 🌐 SHARED FEATURES

### 🔐 Authentication

| "I want to change…" | Edit this file |
|---|---|
| Login / logout / session | `src/lib/auth.js` |
| JWT verification (backend) | `backend/services/auth.py` |
| Tier lookup + caching | `backend/services/auth.py` → `_get_user_tier_from_db()` |
| Admin/owner bypass | `backend/services/auth.py` → `is_admin_exempt()` |
| Auth header for API calls | `src/lib/api.js` → `_getAuthHeader()` |

### 📊 Subscriptions / Plan Limits

| "I want to change…" | Edit this file |
|---|---|
| Per-feature usage quotas | `backend/services/plan_limits.py` |
| Guest usage limits | `backend/guest_limits.py` + `src/lib/guestLimits.js` |
| Usage enforcement in routes | `backend/routes/chat.py`, `flashcards.py`, `study.py`, `image.py` |

### 💾 Database / Persistence

| "I want to change…" | Edit this file |
|---|---|
| Supabase client (frontend) | `src/lib/supabase.js` |
| Generic DB helpers (notes, history) | `src/lib/chunksDb.js` |
| Flashcard DB (decks, cards, SRS) | `src/lib/flashcardDb.js` |
| Exam result storage | `src/lib/examDb.js` |
| User document storage | `src/lib/userDocDb.js` |
| Large data (IndexedDB) | `src/lib/idbStorage.js` |
| Schema migrations | `src/lib/schemaMigrations.js` |
| Offline→online sync | `src/lib/syncManager.js` |
| SQL migrations | `backend/migrations/*.sql` |

### 🤖 AI / Backend Core

| "I want to change…" | Edit this file |
|---|---|
| AI model call (OpenRouter) | `backend/services/ai.py` → `call_ai()` |
| Thinking mode tokens/prompts | `backend/routes/chat.py` + `backend/services/token_budget.py` |
| Deep think prompt structure | `backend/routes/chat.py` (lines 327–352) |
| Thin answer salvage logic | `backend/services/ai.py` → `_salvage_substantive_from_thinking()` |
| Book content / vector search | `backend/services/books.py` + `backend/services/vector_store.py` |
| Response caching | `backend/services/material_cache.py`, `ask_cache.py`, `answer_cache.py` |
| AI prompt guard (injection block) | `backend/services/prompt_guard.py` |
| Background job queue | `backend/services/job_queue.py` |

### 🔴 Realtime (Supabase)

| "I want to change…" | Edit this file |
|---|---|
| Workspace chat realtime | `src/state/workspace/chatRealtime.js` |
| Flashcard realtime sync | `src/state/flash/flashcardRealtime.js` |
| Home messages realtime | `src/state/home/homeMessagesRealtime.js` |

### 🎨 UI Components

| Component | File |
|---|---|
| Chat input bar | `src/components/ChatBar/ChatBar.js` |
| Sidebar (nav + history) | `src/components/Sidebar.js` |
| Library picker modal | `src/components/LibraryModal.js` |
| Settings modal | `src/components/SettingsModal.js` |
| Confirm dialog | `src/components/ConfirmModal.js` / `ConfirmModal.jsx` |
| Toast notifications | `src/components/Toast.js` / `Toast.jsx` |
| Thinking accordion (AI reasoning) | `src/components/ThinkingAccordion.js` / `.jsx` |
| Profile dropdown | `src/components/ProfileDropdown.js` |
| Smart notes panel | `src/components/SmartNotesPanel.jsx` |
| Canvas panel | `src/components/CanvasPanel.jsx` |
| Storage error banner | `src/components/StorageErrorBanner.js` / `.jsx` |

### 🖌️ Styles

| What | File |
|---|---|
| CSS design tokens (colors, fonts, radii) | `src/styles/tokens.css` |
| Base / reset / typography | `src/styles/base.css` |
| Layout (screen grid, panels) | `src/styles/layout.css` |
| Sidebar | `src/styles/sidebar.css` |
| Modals (shared) | `src/styles/modals.css` + `src/styles/modals/` |
| Responsive / mobile | `src/styles/responsive.css` |
| Home screen | `src/styles/screens/home.css` |
| Workspace screen | `src/styles/screens/workspace.css` |
| Flashcard screen | `src/styles/screens/flash.css` |
| Exam screen | `src/styles/screens/exam.css` |
| Study Plan screen | `src/styles/screens/studyplan.css` |
| Research screen | `src/styles/screens/research.css` |
| Visual Tutor screen | `src/styles/screens/visual-tutor.css` |
| Library screen | `src/styles/screens/library.css` |

### 🗺️ Navigation / Routing

| "I want to change…" | Edit this file |
|---|---|
| URL ↔ screen name table | `src/state/navigation/routes.js` |
| Screen switching logic (`showScreen`) | `src/state/navigation/screens.js` |
| App bootstrap / initial screen | `src/state/navigation/init.js` |
| Mobile nav drawer | `src/state/navigation/mobile.js` |

### 🎙️ Voice

| "I want to change…" | Edit this file |
|---|---|
| Voice input (STT) | `src/state/workspace/voice.js` → `wsToggleVoiceInput()` |
| Read-aloud (TTS) | `src/state/workspace/voice.js` → `wsReadAloud()` |
| Listen to PDF | `src/state/workspace/voice.js` → `wsListenPdf()` |

### 🤖 AI Auto-Thinking Mode

| "I want to change…" | Edit this file |
|---|---|
| Question complexity classifier | `src/utils/questionClassifier.js` |
| Complexity → mode mapping | `src/utils/questionClassifier.js` → `mapComplexityToMode()` |
| Backend mode → token budget | `backend/routes/chat.py` + `backend/services/token_budget.py` |
| Deep think prompt | `backend/routes/chat.py` (lines 327–352) |

### ⚙️ Command Engine

| "I want to change…" | Edit this file |
|---|---|
| Slash commands / action dispatch | `src/state/commandEngine.js` |

### 📡 Content Sharing

| "I want to change…" | Edit this file |
|---|---|
| Share a chat/result | `src/state/share.js` |
| Backend share store | `backend/services/share_store.py` + `backend/routes/share_content.py` |

### 🔧 Infrastructure

| "I want to change…" | Edit this file |
|---|---|
| All `window.*` global bindings | `src/globals.js` |
| App entry point | `src/main.js` |
| Vite build config | `vite.config.js` |
| FastAPI server setup + middleware | `backend/server.py` |
| Backend route registration | `backend/server.py` + `backend/routes/__init__.py` |
| Rate limiting | `backend/routes/limiter.py` |
| Redis client / Sentinel | `backend/services/redis_client.py` |
| Device abuse detection | `backend/services/device_abuse.py` |
| CORS / CSRF settings | `backend/server.py` |
| Docker setup | `Dockerfile`, `backend/Dockerfile`, `docker-compose.yml` |
| Nginx config | `nginx/default.conf.template` |
| Kubernetes manifests | `k8s/` |
| CI pipeline | `.github/workflows/ci.yml` |
| Backend tests | `backend/tests/` |
