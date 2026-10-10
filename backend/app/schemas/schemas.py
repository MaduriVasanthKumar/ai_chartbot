from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class AuthRegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    display_name: Optional[str] = None

class AuthLoginRequest(BaseModel):
    email: str
    password: str

class AuthUserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: str
    last_login_at: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUserResponse

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    academic_level: Optional[str] = None
    preferred_language: Optional[str] = None
    learning_preferences: Optional[Dict[str, Any]] = None

class ProfileResponse(BaseModel):
    id: str
    display_name: str
    academic_level: str
    preferred_language: str
    learning_preferences: Dict[str, Any]
    created_at: str
    updated_at: str

class ChatMessageCreate(BaseModel):
    content: str
    mode: Optional[str] = "general"
    language: Optional[str] = "en"
    document_id: Optional[str] = None
    web_search: Optional[bool] = False

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    user_id: str
    role: str
    content: str
    metadata: Dict[str, Any]
    created_at: str

class ConversationCreate(BaseModel):
    title: Optional[str] = "New Study Session"
    mode: Optional[str] = "general"

class ConversationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    mode: str
    created_at: str
    updated_at: str
    message_count: Optional[int] = 0
    last_message: Optional[str] = None

class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    mode: Optional[str] = None

class StudentMemoryCreate(BaseModel):
    memory_type: str = "preference"
    content: str
    source_conversation_id: Optional[str] = None

class StudentMemoryResponse(BaseModel):
    id: str
    user_id: str
    memory_type: str
    content: str
    source_conversation_id: Optional[str]
    confidence: float
    created_at: str

class QuizGenerateRequest(BaseModel):
    subject: str
    topic: str
    difficulty: str = "medium"  # easy, medium, hard
    num_questions: int = 5
    question_type: str = "multiple-choice"  # multiple-choice, true-false, short-answer

class QuizQuestion(BaseModel):
    id: int
    question: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: str

class QuizResponse(BaseModel):
    id: str
    title: str
    subject: str
    topic: str
    difficulty: str
    questions: List[QuizQuestion]
    created_at: str

class QuizSubmitRequest(BaseModel):
    answers: Dict[str, str]  # question_id -> user_answer

class QuizAttemptResponse(BaseModel):
    id: str
    quiz_id: str
    score: int
    total_questions: int
    percentage: float
    answers: Dict[str, str]
    completed_at: str
    review: List[Dict[str, Any]]

class StudyPlanGenerateRequest(BaseModel):
    goal: str
    subjects: List[str]
    exam_date: str
    available_hours_per_day: float = 2.0

class StudyTaskResponse(BaseModel):
    id: str
    study_plan_id: str
    title: str
    subject: str
    scheduled_date: str
    estimated_minutes: int
    status: str
    completed_at: Optional[str] = None

class StudyPlanResponse(BaseModel):
    id: str
    title: str
    goal: str
    start_date: str
    end_date: str
    tasks: List[StudyTaskResponse]
    progress_percentage: float
    created_at: str

class MockInterviewCreateRequest(BaseModel):
    subject: str = Field(min_length=2, max_length=120)
    course: str = Field(default="", max_length=160)
    target_role: str = Field(default="", max_length=160)
    experience_level: str = Field(default="student", max_length=40)
    interview_type: str = Field(default="mixed", max_length=40)
    difficulty: str = Field(default="medium", max_length=20)
    question_count: int = Field(default=5, ge=3, le=10)
    time_limit_seconds: int = Field(default=180, ge=30, le=900)

class MockInterviewEvaluateRequest(BaseModel):
    answers: Dict[str, str] = Field(default_factory=dict)
    durations: Dict[str, int] = Field(default_factory=dict)

class ImageGenerateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=2000)
    style: str = Field(default="educational illustration", max_length=60)
    aspect_ratio: str = Field(default="1:1", max_length=10)

class AnalyticsOverviewResponse(BaseModel):
    total_conversations: int
    total_messages: int
    quizzes_completed: int
    average_quiz_score: float
    study_tasks_completed: int
    study_tasks_total: int
    topic_breakdown: List[Dict[str, Any]]
    weak_subjects: List[str]
    recommendations: List[Dict[str, str]]
    recent_activity: List[Dict[str, Any]]
