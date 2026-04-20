"""
backend/routes/schemas.py — Pydantic request / response models.

Every JSON-accepting endpoint has a *Request* model that is validated
automatically by the ``@validate_request`` decorator (see validation.py).

Response models are provided for documentation and optional serialisation;
they are **not** enforced on the wire today so existing behaviour is
unchanged.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ── helpers ───────────────────────────────────────────────────────────────────

class _StrictBase(BaseModel):
    """Shared base: forbid unknown fields to catch typos early."""
    model_config = {"extra": "forbid"}


class _LenientBase(BaseModel):
    """Lenient base: allow (and ignore) unknown fields."""
    model_config = {"extra": "allow"}


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  /ask                                                                      ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

_AskMode = Literal[
    # Current modes
    'snap', 'chunk', 'master', 'research',
    # Legacy modes still handled by ai_router.py
    'concise', 'study', 'detailed', 'practice', 'summary', 'generate', 'exam', 'general',
    # Visual/tutoring modes
    'visual_tutor',
]


class AskRequest(_LenientBase):
    question: str = Field(default="", max_length=200_000)
    complexity: int = Field(default=3, ge=1, le=10)
    mode: _AskMode = 'snap'
    bookId: Optional[str] = None
    thinking: Optional[str] = None
    web_search: bool = False
    stream: bool = False
    history: List[Any] = Field(default_factory=list)
    selected_text: str = ""
    doc_context: str = ""
    user_memory: str = ""
    task_type: Optional[str] = None
    student_profile: str = ""
    student_gaps: List[Any] = Field(default_factory=list)
    viewer_state: Optional[Dict[str, Any]] = None
    """Current viewer state for context-aware routing.

    Expected shape::

        {
            "type": "youtube" | "pdf" | "research" | "none",
            "video_id": str,                    # optional, YouTube only
            "current_timestamp_seconds": float, # optional, YouTube only
            "visible_segment": str,             # optional, visible transcript text
            "pdf_page": int,                    # optional, PDF only
            "pdf_visible_text": str,            # optional, PDF only
        }
    """


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  /ask-async                                                                ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class AskAsyncRequest(_LenientBase):
    """Identical to AskRequest — used for the async /ask-async endpoint."""
    question: str = Field(default="", max_length=200_000)
    complexity: int = Field(default=3, ge=1, le=10)
    mode: _AskMode = 'snap'
    bookId: Optional[str] = None
    thinking: Optional[str] = None
    web_search: bool = False
    history: List[Any] = Field(default_factory=list)
    selected_text: str = ""
    doc_context: str = ""
    user_memory: str = ""
    task_type: Optional[str] = None


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  /generate-flashcards                                                      ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class FlashcardsRequest(_LenientBase):
    topic: str = "chemistry"
    count: int = Field(default=10, ge=1, le=20)
    bookId: Optional[str] = None


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  /generate-study-materials                                                 ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class SlideItem(BaseModel):
    model_config = {"extra": "allow"}
    title: str = ""
    slide_number: Any = None
    content: List[str] = Field(default_factory=list)
    notes: str = ""


class StudyMaterialsRequest(_LenientBase):
    slides: List[SlideItem] = Field(default_factory=list)
    type: str = "notes"


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  /generate-quiz                                                            ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class QuizRequest(_LenientBase):
    slides: List[SlideItem] = Field(default_factory=list)
    count: int = Field(default=10, ge=5, le=50)
    difficulty: str = "medium"
    mode: str = "standard"
    question_type: str = "mcq"
    existingQuestions: List[str] = Field(default_factory=list)


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  /ask-image                                                                ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class ImageRequest(_LenientBase):
    image_b64: str = ""
    image_type: str = "image/jpeg"
    complexity: int = Field(default=5, ge=1, le=10)
    question: str = "Describe what you see and explain any chemistry concepts visible."


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  /load-book                                                                ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class LoadBookRequest(_LenientBase):
    bookId: str


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  /api/admin/verify-access                                                  ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class AdminVerifyRequest(_LenientBase):
    pin: Optional[str] = None


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  /api/admin/users/<email>  (PATCH)                                         ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class AdminUpdateUserRequest(_LenientBase):
    """Intentionally open — any user-row fields are accepted."""
    pass


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  /api/admin/set-role  (POST)                                               ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class AdminSetRoleRequest(_StrictBase):
    """Body for POST /api/admin/set-role — owner-only role assignment."""
    user_email: str = Field(..., description="Email of the user whose role should change.")
    role: Literal['user', 'admin', 'owner'] = Field(
        ..., description="New role: 'user' | 'admin' | 'owner'."
    )


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  PAEV routes                                                               ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class PaevBuildIndexRequest(_LenientBase):
    bookId: Optional[str] = None
    fingerprintSampleRate: float = Field(default=0.3, ge=0.0, le=1.0)


class PaevAskRequest(_LenientBase):
    question: str = ""
    bookId: Optional[str] = None
    complexity: int = Field(default=5, ge=1, le=10)
    history: List[Any] = Field(default_factory=list)


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  Progress routes                                                           ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class ProgressReadinessRequest(_LenientBase):
    progress: Dict[str, Any] = Field(default_factory=dict)
    examDate: str = ""


class ProgressWeakSpotsRequest(_LenientBase):
    progress: Dict[str, Any] = Field(default_factory=dict)


class ProgressStudyPlanRequest(_LenientBase):
    examDate: str = ""
    bookId: Optional[str] = None
    progress: Dict[str, Any] = Field(default_factory=dict)
    weakSpots: List[Any] = Field(default_factory=list)


class ProgressBadgesRequest(_LenientBase):
    progress: Dict[str, Any] = Field(default_factory=dict)


class ProgressStreakCheckRequest(_LenientBase):
    lastStudied: str = ""
    currentStreak: int = 0


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  Response models (informational / optional validation)                     ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class ErrorResponse(BaseModel):
    success: Literal[False] = False
    error: str


class AskResponse(BaseModel):
    model_config = {"extra": "allow"}
    success: bool
    answer: str = ""
    mode: str = ""


class FlashcardItem(BaseModel):
    front: str
    back: str


class FlashcardsResponse(BaseModel):
    model_config = {"extra": "allow"}
    success: bool
    flashcards: List[FlashcardItem] = Field(default_factory=list)
    count: int = 0
    topic: str = ""


class UploadResponse(BaseModel):
    model_config = {"extra": "allow"}
    success: bool
    slides: List[Any] = Field(default_factory=list)
    total_slides: int = 0
    filename: str = ""


class StudyMaterialsResponse(BaseModel):
    model_config = {"extra": "allow"}
    success: bool
    materials: Dict[str, Any] = Field(default_factory=dict)


class QuizQuestionItem(BaseModel):
    model_config = {"extra": "allow"}
    number: Any = None
    question: str = ""
    options: Dict[str, str] = Field(default_factory=dict)
    answer: str = ""
    explanation: str = ""


class QuizResponse(BaseModel):
    model_config = {"extra": "allow"}
    success: bool
    questions: List[QuizQuestionItem] = Field(default_factory=list)
    count: int = 0
    difficulty: str = ""


class ImageResponse(BaseModel):
    model_config = {"extra": "allow"}
    success: bool
    answer: str = ""
    model: str = ""


class LoadBookResponse(BaseModel):
    model_config = {"extra": "allow"}
    success: bool
    book_id: str = ""
    book_name: str = ""
    author: str = ""
    chunks_count: int = 0


class AskAsyncResponse(BaseModel):
    """Response from POST /ask-async."""
    success: bool
    jobId: str = ""
    status: str = "queued"


class JobStatusResponse(BaseModel):
    """Response from GET /jobs/<job_id>."""
    model_config = {"extra": "allow"}
    success: bool
    jobId: str = ""
    status: str = ""
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  /api/share                                                                ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

class ShareCreateRequest(_LenientBase):
    """Body for POST /api/share — create a shareable link."""
    type: Literal["deck", "exam", "plan"]
    data: Dict[str, Any] = Field(default_factory=dict)
