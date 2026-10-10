import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials

from app.auth import (
    TOKEN_TTL_DAYS,
    bearer_scheme,
    create_session,
    get_current_user,
    get_current_user_id,
    hash_password,
    normalize_email,
    revoke_session,
    validate_email,
    verify_password,
)
from app.db.database import get_db
from app.schemas.schemas import (
    AnalyticsOverviewResponse,
    AuthLoginRequest,
    MockInterviewCreateRequest,
    MockInterviewEvaluateRequest,
    ImageGenerateRequest,
    AuthRegisterRequest,
    AuthResponse,
    AuthUserResponse,
    ChatMessageCreate,
    ConversationCreate,
    ConversationResponse,
    ConversationUpdate,
    MessageResponse,
    ProfileResponse,
    ProfileUpdate,
    QuizAttemptResponse,
    QuizGenerateRequest,
    QuizResponse,
    QuizSubmitRequest,
    StudentMemoryCreate,
    StudentMemoryResponse,
    StudyPlanGenerateRequest,
    StudyPlanResponse,
    StudyTaskResponse,
)
from app.services.ai_service import GeminiServiceError, generate_ai_response
from app.services.analytics_service import AnalyticsService
from app.services.document_service import DocumentService
from app.services.memory_service import MemoryService
from app.services.mock_interview_service import MockInterviewService
from app.services.image_generation_service import (
    ImageGenerationQuotaError,
    ImageGenerationService,
    ImageGenerationServiceError,
)
from app.services.quiz_service import QuizService
from app.services.study_service import StudyService

router = APIRouter()


# --- Health Check ---
@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "EduMate AI Backend",
    }


# --- Authentication ---
def _auth_user_response(user: Dict[str, Any]) -> Dict[str, Any]:
    email = user["email"]
    return {
        "id": user["id"],
        "email": email,
        "display_name": user.get("display_name") or email.split("@")[0],
        "created_at": user["created_at"],
        "last_login_at": user.get("last_login_at"),
    }


def _create_profile_for_user(user_id: str, display_name: str, now: str) -> None:
    conn = get_db()
    conn.execute(
        """INSERT OR IGNORE INTO profiles
           (id, display_name, academic_level, preferred_language,
            learning_preferences, created_at, updated_at)
           VALUES (?, ?, 'Undergraduate', 'en', '{}', ?, ?)""",
        (user_id, display_name, now, now),
    )
    conn.commit()
    conn.close()


@router.post("/api/auth/register", response_model=AuthResponse, status_code=201)
def register(body: AuthRegisterRequest):
    email = normalize_email(body.email)
    if not validate_email(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address")

    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM users WHERE email = ? COLLATE NOCASE", (email,)
    ).fetchone()
    if existing:
        conn.close()
        raise HTTPException(
            status_code=409, detail="An account with this email already exists"
        )

    now = datetime.utcnow().isoformat()
    users_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    legacy_profile = conn.execute(
        "SELECT id FROM profiles WHERE id = 'default_user'"
    ).fetchone()
    user_id = (
        "default_user"
        if users_count == 0 and legacy_profile
        else f"user_{uuid.uuid4().hex[:12]}"
    )
    display_name = (
        (body.display_name or email.split("@")[0]).strip()[:80]
        or email.split("@")[0]
    )

    conn.execute(
        """INSERT INTO users
           (id, email, password_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)""",
        (user_id, email, hash_password(body.password), now, now),
    )
    conn.commit()
    conn.close()
    _create_profile_for_user(user_id, display_name, now)

    user = {
        "id": user_id,
        "email": email,
        "created_at": now,
        "last_login_at": None,
        "display_name": display_name,
    }
    return {
        "access_token": create_session(user),
        "token_type": "bearer",
        "expires_in": TOKEN_TTL_DAYS * 24 * 60 * 60,
        "user": _auth_user_response(user),
    }


@router.post("/api/auth/login", response_model=AuthResponse)
def login(body: AuthLoginRequest):
    email = normalize_email(body.email)
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM users WHERE email = ? COLLATE NOCASE", (email,)
    ).fetchone()
    if not row or not verify_password(body.password, row["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    now = datetime.utcnow().isoformat()
    conn.execute(
        "UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?",
        (now, now, row["id"]),
    )
    profile = conn.execute(
        "SELECT display_name FROM profiles WHERE id = ?", (row["id"],)
    ).fetchone()
    conn.commit()
    conn.close()

    user = {
        **dict(row),
        "last_login_at": now,
        "display_name": profile["display_name"]
        if profile
        else email.split("@")[0],
    }
    return {
        "access_token": create_session(user),
        "token_type": "bearer",
        "expires_in": TOKEN_TTL_DAYS * 24 * 60 * 60,
        "user": _auth_user_response(user),
    }


@router.get("/api/auth/me", response_model=AuthUserResponse)
def get_me(user: Dict[str, Any] = Depends(get_current_user)):
    return _auth_user_response(user)


@router.post("/api/auth/logout")
def logout(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
):
    if credentials and credentials.scheme.lower() == "bearer":
        revoke_session(credentials.credentials)
    return {"status": "ok"}


# --- Student Profile ---
@router.get("/api/profile", response_model=ProfileResponse)
def get_profile(user_id: str = Depends(get_current_user_id)):
    conn = get_db()
    row = conn.execute("SELECT * FROM profiles WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    data = dict(row)
    data["learning_preferences"] = json.loads(data.get("learning_preferences", "{}"))
    return data


@router.patch("/api/profile", response_model=ProfileResponse)
def update_profile(
    body: ProfileUpdate, user_id: str = Depends(get_current_user_id)
):
    conn = get_db()
    row = conn.execute("SELECT * FROM profiles WHERE id = ?", (user_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Profile not found")

    current = dict(row)
    display_name = (
        body.display_name
        if body.display_name is not None
        else current["display_name"]
    )
    academic_level = (
        body.academic_level
        if body.academic_level is not None
        else current["academic_level"]
    )
    preferred_language = (
        body.preferred_language
        if body.preferred_language is not None
        else current["preferred_language"]
    )
    prefs = json.loads(current.get("learning_preferences", "{}"))
    if body.learning_preferences is not None:
        prefs.update(body.learning_preferences)

    now = datetime.utcnow().isoformat()
    conn.execute(
        """UPDATE profiles
           SET display_name = ?, academic_level = ?, preferred_language = ?,
               learning_preferences = ?, updated_at = ?
           WHERE id = ?""",
        (
            display_name,
            academic_level,
            preferred_language,
            json.dumps(prefs),
            now,
            user_id,
        ),
    )
    conn.commit()
    conn.close()
    return {
        "id": user_id,
        "display_name": display_name,
        "academic_level": academic_level,
        "preferred_language": preferred_language,
        "learning_preferences": prefs,
        "created_at": current["created_at"],
        "updated_at": now,
    }


# --- Conversations & Chat ---
@router.get("/api/conversations", response_model=List[ConversationResponse])
def get_conversations(user_id: str = Depends(get_current_user_id)):
    conn = get_db()
    rows = conn.execute(
        """SELECT c.id, c.user_id, c.title, c.mode, c.created_at, c.updated_at,
                  COUNT(m.id) AS message_count,
                  (SELECT content FROM messages
                   WHERE conversation_id = c.id
                   ORDER BY created_at DESC LIMIT 1) AS last_message
           FROM conversations c
           LEFT JOIN messages m ON c.id = m.conversation_id
           WHERE c.user_id = ? AND c.archived_at IS NULL
           GROUP BY c.id
           ORDER BY c.updated_at DESC""",
        (user_id,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


@router.post("/api/conversations", response_model=ConversationResponse)
def create_conversation(
    body: ConversationCreate, user_id: str = Depends(get_current_user_id)
):
    conv_id = f"conv_{uuid.uuid4().hex[:10]}"
    now = datetime.utcnow().isoformat()
    title = body.title or "New Study Session"
    mode = body.mode or "general"
    conn = get_db()
    conn.execute(
        """INSERT INTO conversations
           (id, user_id, title, mode, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (conv_id, user_id, title, mode, now, now),
    )
    conn.commit()
    conn.close()
    return {
        "id": conv_id,
        "user_id": user_id,
        "title": title,
        "mode": mode,
        "created_at": now,
        "updated_at": now,
        "message_count": 0,
        "last_message": None,
    }


@router.get("/api/conversations/{conversation_id}")
def get_conversation_details(
    conversation_id: str, user_id: str = Depends(get_current_user_id)
):
    conn = get_db()
    conv = conn.execute(
        "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
        (conversation_id, user_id),
    ).fetchone()
    if not conv:
        conn.close()
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages_rows = conn.execute(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conversation_id,),
    ).fetchall()
    conn.close()
    messages = []
    for row in messages_rows:
        message = dict(row)
        message["metadata"] = json.loads(message.get("metadata", "{}"))
        messages.append(message)
    result = dict(conv)
    result["messages"] = messages
    return result


@router.patch("/api/conversations/{conversation_id}", response_model=ConversationResponse)
def update_conversation(
    conversation_id: str,
    body: ConversationUpdate,
    user_id: str = Depends(get_current_user_id),
):
    conn = get_db()
    conv = conn.execute(
        "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
        (conversation_id, user_id),
    ).fetchone()
    if not conv:
        conn.close()
        raise HTTPException(status_code=404, detail="Conversation not found")

    current = dict(conv)
    title = body.title if body.title is not None else current["title"]
    mode = body.mode if body.mode is not None else current["mode"]
    now = datetime.utcnow().isoformat()
    conn.execute(
        "UPDATE conversations SET title = ?, mode = ?, updated_at = ? WHERE id = ?",
        (title, mode, now, conversation_id),
    )
    conn.commit()
    conn.close()
    return {
        "id": conversation_id,
        "user_id": user_id,
        "title": title,
        "mode": mode,
        "created_at": current["created_at"],
        "updated_at": now,
        "message_count": 0,
        "last_message": None,
    }


@router.delete("/api/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str, user_id: str = Depends(get_current_user_id)
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM conversations WHERE id = ? AND user_id = ?",
        (conversation_id, user_id),
    )
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted", "id": conversation_id}


@router.post("/api/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: ChatMessageCreate,
    user_id: str = Depends(get_current_user_id),
):
    conn = get_db()
    conv = conn.execute(
        "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
        (conversation_id, user_id),
    ).fetchone()
    if not conv:
        conn.close()
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv_dict = dict(conv)

    now = datetime.utcnow().isoformat()
    user_msg_id = f"msg_{uuid.uuid4().hex[:10]}"
    conn.execute(
        """INSERT INTO messages
           (id, conversation_id, user_id, role, content, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            user_msg_id,
            conversation_id,
            user_id,
            "user",
            body.content,
            json.dumps({}),
            now,
            now,
        ),
    )
    if conv_dict["title"] in ("New Study Session", "New Chat"):
        new_title = body.content[:35] + ("..." if len(body.content) > 35 else "")
        conn.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (new_title, now, conversation_id),
        )
    else:
        conn.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?",
            (now, conversation_id),
        )
    conn.commit()
    conn.close()

    MemoryService.auto_extract_memories_if_applicable(
        user_id, body.content, conversation_id
    )
    MemoryService.summarize_conversation_if_needed(conversation_id)
    history = MemoryService.get_recent_conversation_messages(conversation_id, limit=15)
    memories_raw = MemoryService.get_user_memories(user_id)
    memories = [memory["content"] for memory in memories_raw]

    doc_context = None
    if body.document_id:
        _assert_document_owner(body.document_id, user_id)
        doc_context = DocumentService.get_document_context(body.document_id, body.content)

    conn = get_db()
    profile_row = conn.execute(
        "SELECT * FROM profiles WHERE id = ?", (user_id,)
    ).fetchone()
    conn.close()
    profile = dict(profile_row) if profile_row else None

    try:
        assistant_reply = await generate_ai_response(
            messages=history,
            mode=body.mode or conv_dict["mode"],
            language=body.language or "en",
            memories=memories,
            profile=profile,
            document_context=doc_context,
        )
    except GeminiServiceError as error:
        # Keep provider failures explicit. Do not persist a fabricated assistant reply.
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error

    assistant_id = f"msg_{uuid.uuid4().hex[:10]}"
    assistant_time = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute(
        """INSERT INTO messages
           (id, conversation_id, user_id, role, content, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            assistant_id,
            conversation_id,
            user_id,
            "assistant",
            assistant_reply,
            json.dumps({"mode": body.mode}),
            assistant_time,
            assistant_time,
        ),
    )
    conn.commit()
    conn.close()
    return {
        "user_message": {
            "id": user_msg_id,
            "conversation_id": conversation_id,
            "user_id": user_id,
            "role": "user",
            "content": body.content,
            "created_at": now,
        },
        "assistant_message": {
            "id": assistant_id,
            "conversation_id": conversation_id,
            "user_id": user_id,
            "role": "assistant",
            "content": assistant_reply,
            "created_at": assistant_time,
        },
    }


# --- Student Memories ---
@router.get("/api/memories", response_model=List[StudentMemoryResponse])
def get_memories(user_id: str = Depends(get_current_user_id)):
    return MemoryService.get_user_memories(user_id)


@router.post("/api/memories", response_model=StudentMemoryResponse)
def add_memory(
    body: StudentMemoryCreate, user_id: str = Depends(get_current_user_id)
):
    if body.source_conversation_id:
        _assert_conversation_owner(body.source_conversation_id, user_id)
    return MemoryService.add_user_memory(
        user_id, body.content, body.memory_type, body.source_conversation_id
    )


@router.delete("/api/memories/{memory_id}")
def delete_memory(memory_id: str, user_id: str = Depends(get_current_user_id)):
    success = MemoryService.delete_user_memory(memory_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"status": "deleted", "id": memory_id}


@router.delete("/api/memories")
def clear_all_memories(user_id: str = Depends(get_current_user_id)):
    count = MemoryService.clear_all_user_memories(user_id)
    return {"status": "cleared", "count": count}


# --- Document Library & Q&A ---
def _assert_document_owner(document_id: str, user_id: str) -> None:
    conn = get_db()
    row = conn.execute(
        "SELECT id FROM documents WHERE id = ? AND user_id = ?",
        (document_id, user_id),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")


def _assert_conversation_owner(conversation_id: str, user_id: str) -> None:
    conn = get_db()
    row = conn.execute(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
        (conversation_id, user_id),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")


@router.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...), user_id: str = Depends(get_current_user_id)
):
    contents = await file.read()
    doc = DocumentService.process_and_save_document(
        user_id, file.filename or "uploaded-document", contents
    )
    return doc


@router.get("/api/documents")
def get_documents(user_id: str = Depends(get_current_user_id)):
    return DocumentService.get_user_documents(user_id)


# --- Quizzes & Practice ---
@router.post("/api/quizzes/generate", response_model=QuizResponse)
async def generate_quiz(
    body: QuizGenerateRequest, user_id: str = Depends(get_current_user_id)
):
    return await QuizService.generate_quiz(
        user_id=user_id,
        subject=body.subject,
        topic=body.topic,
        difficulty=body.difficulty,
        num_questions=body.num_questions,
        question_type=body.question_type,
    )


@router.post("/api/quizzes/{quiz_id}/submit", response_model=QuizAttemptResponse)
def submit_quiz(
    quiz_id: str,
    body: QuizSubmitRequest,
    user_id: str = Depends(get_current_user_id),
):
    conn = get_db()
    quiz = conn.execute(
        "SELECT id FROM quizzes WHERE id = ? AND user_id = ?", (quiz_id, user_id)
    ).fetchone()
    conn.close()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    try:
        return QuizService.evaluate_quiz_submission(quiz_id, user_id, body.answers)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/api/quizzes/history")
def get_quiz_history(user_id: str = Depends(get_current_user_id)):
    return QuizService.get_quiz_history(user_id)


# --- Study Planner ---
@router.post("/api/study-plans/generate", response_model=StudyPlanResponse)
def generate_study_plan(
    body: StudyPlanGenerateRequest, user_id: str = Depends(get_current_user_id)
):
    return StudyService.generate_study_plan(
        user_id=user_id,
        goal=body.goal,
        subjects=body.subjects,
        exam_date=body.exam_date,
        available_hours_per_day=body.available_hours_per_day,
    )


@router.get("/api/study-plans", response_model=List[StudyPlanResponse])
def get_study_plans(user_id: str = Depends(get_current_user_id)):
    return StudyService.get_user_study_plans(user_id)


@router.patch("/api/study-tasks/{task_id}", response_model=StudyTaskResponse)
def update_study_task(
    task_id: str,
    status: str,
    user_id: str = Depends(get_current_user_id),
):
    conn = get_db()
    task = conn.execute(
        """SELECT t.id FROM study_tasks t
           JOIN study_plans p ON p.id = t.study_plan_id
           WHERE t.id = ? AND p.user_id = ?""",
        (task_id, user_id),
    ).fetchone()
    conn.close()
    if not task:
        raise HTTPException(status_code=404, detail="Study task not found")
    try:
        return StudyService.update_task_status(task_id, status)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


# --- AI Mock Interviews ---
@router.post("/api/mock-interviews")
async def create_mock_interview(
    body: MockInterviewCreateRequest,
    user_id: str = Depends(get_current_user_id),
):
    return await MockInterviewService.create_interview(user_id, body.model_dump())


@router.post("/api/mock-interviews/{interview_id}/evaluate")
async def evaluate_mock_interview(
    interview_id: str,
    body: MockInterviewEvaluateRequest,
    user_id: str = Depends(get_current_user_id),
):
    try:
        return await MockInterviewService.evaluate_interview(
            user_id, interview_id, body.answers, body.durations
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/api/mock-interviews")
def get_mock_interview_history(user_id: str = Depends(get_current_user_id)):
    return MockInterviewService.get_history(user_id)


@router.get("/api/mock-interviews/{interview_id}")
def get_mock_interview(interview_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        return MockInterviewService.get_detail(user_id, interview_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/api/mock-interviews/{interview_id}/email")
def email_mock_interview_report(
    interview_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    try:
        sent, message, email = MockInterviewService.send_report(user, interview_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return {
        "sent": sent,
        "message": message,
        "email": email,
    }


# --- AI Image Generation ---
@router.post("/api/images/generate")
async def generate_image(
    body: ImageGenerateRequest,
    user_id: str = Depends(get_current_user_id),
):
    # The dependency enforces account authentication; generation is currently
    # stateless and the user ID is intentionally not persisted.
    del user_id
    try:
        return await ImageGenerationService.generate(
            prompt=body.prompt,
            style=body.style,
            aspect_ratio=body.aspect_ratio,
        )
    except ImageGenerationQuotaError as error:
        raise HTTPException(status_code=429, detail=str(error)) from error
    except (ImageGenerationServiceError, ValueError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


# --- Learning Analytics ---
@router.get("/api/analytics/overview", response_model=AnalyticsOverviewResponse)
def get_analytics_overview(user_id: str = Depends(get_current_user_id)):
    return AnalyticsService.get_overview(user_id)
