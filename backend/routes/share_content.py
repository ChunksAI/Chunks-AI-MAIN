"""
backend/routes/share_content.py — Shareable-link API.

Endpoints
---------
POST /api/share
    Create a new share record for a deck, exam, or study plan.
    Requires authentication (JWT).  Returns a unique share_id and URL.

GET /api/share/<share_id>
    Retrieve a share record by ID.  Public — no auth required.
    Returns the full data payload needed to render the shared page.
"""
from __future__ import annotations

import logging

from flask import Blueprint, jsonify, request

from routes.validation import validate_request
from routes.schemas import ShareCreateRequest

logger = logging.getLogger(__name__)

share_bp = Blueprint("share", __name__)

# ── URL helpers ────────────────────────────────────────────────────────────────

_PAGE_MAP = {
    "deck": "/share/deck.html",
    "exam": "/share/exam.html",
    "plan": "/share/study-plan.html",
}


def _share_url(share_type: str, share_id: str) -> str:
    """Return the frontend URL for a shared item."""
    page = _PAGE_MAP.get(share_type, "/share/deck.html")
    return f"{page}?id={share_id}"


# ── POST /api/share ────────────────────────────────────────────────────────────

@share_bp.route("/api/share", methods=["POST", "OPTIONS"])
@validate_request(ShareCreateRequest)
def create_share():
    """Create a shareable link.  Requires a valid JWT."""
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    try:
        from services.auth import _extract_verified_user
        verified_user_id, _tier = _extract_verified_user()
    except Exception as exc:
        return jsonify({"success": False, "error": "Authentication required"}), 401

    data = request.get_json(silent=True) or {}
    share_type = data.get("type")
    payload = data.get("data", {})

    if share_type not in ("deck", "exam", "plan"):
        return jsonify({"success": False, "error": "Invalid share type"}), 400

    try:
        from services.share_store import create_share
        share_id = create_share(share_type, payload, user_id=verified_user_id)
    except Exception as exc:
        logger.exception("share_store.create_share failed")
        return jsonify({"success": False, "error": str(exc)}), 500

    url = _share_url(share_type, share_id)
    logger.info("Share created type=%s id=%s user=%s", share_type, share_id, verified_user_id)
    return jsonify({"success": True, "share_id": share_id, "url": url})


# ── GET /api/share/<share_id> ──────────────────────────────────────────────────

@share_bp.route("/api/share/<share_id>", methods=["GET"])
def get_share(share_id: str):
    """Retrieve share data.  Public — no authentication required."""
    if not share_id or len(share_id) > 64:
        return jsonify({"success": False, "error": "Invalid share ID"}), 400

    try:
        from services.share_store import get_share as _get
        record = _get(share_id)
    except Exception as exc:
        logger.exception("share_store.get_share failed")
        return jsonify({"success": False, "error": "Internal error"}), 500

    if record is None:
        return jsonify({"success": False, "error": "Share not found"}), 404

    return jsonify({
        "success":    True,
        "share_id":   record["share_id"],
        "type":       record["type"],
        "data":       record["data"],
        "created_at": record.get("created_at", ""),
    })
