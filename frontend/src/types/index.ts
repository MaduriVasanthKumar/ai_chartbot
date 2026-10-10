export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  last_login_at?: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export interface Profile {
  id: string;
  display_name: string;
  academic_level: string;
  preferred_language: string;
  learning_preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  mode: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string;
  messages?: Message[];
}

export interface StudentMemory {
  id: string;
  user_id: string;
  memory_type: string;
  content: string;
  source_conversation_id?: string;
  confidence: number;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  file_type: string;
  summary: string;
  created_at: string;
  page_count?: number;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  questions: QuizQuestion[];
  created_at: string;
}

export interface QuizReviewItem {
  question_id: number;
  question: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  title?: string;
  subject?: string;
  topic?: string;
  score: number;
  total_questions: number;
  percentage: number;
  answers: Record<string, string>;
  completed_at: string;
  review?: QuizReviewItem[];
}

export interface StudyTask {
  id: string;
  study_plan_id: string;
  title: string;
  subject: string;
  scheduled_date: string;
  estimated_minutes: number;
  status: 'pending' | 'completed';
  completed_at?: string;
}

export interface StudyPlan {
  id: string;
  title: string;
  goal: string;
  start_date: string;
  end_date: string;
  tasks: StudyTask[];
  progress_percentage: number;
  created_at: string;
}

export interface MockInterviewQuestion {
  id: number;
  question: string;
  category: string;
}

export interface MockInterview {
  id: string;
  subject: string;
  course: string;
  target_role: string;
  experience_level: string;
  interview_type: string;
  difficulty: string;
  question_count: number;
  time_limit_seconds: number;
  questions: MockInterviewQuestion[];
  status: string;
  email_status: string;
  emailed_to?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface MockInterviewQuestionResult {
  question_id: number;
  question: string;
  answer: string;
  duration_seconds: number;
  score: number;
  max_score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface MockInterviewResult {
  id: string;
  subject: string;
  course: string;
  target_role: string;
  difficulty: string;
  interview_type: string;
  overall_score: number;
  max_score: number;
  percentage: number;
  recommendation: string;
  strengths: string[];
  improvements: string[];
  question_results: MockInterviewQuestionResult[];
  completed_at: string;
  email_status?: string;
  emailed_to?: string | null;
}

export interface MockInterviewHistoryItem {
  id: string;
  subject: string;
  course: string;
  target_role: string;
  experience_level: string;
  interview_type: string;
  difficulty: string;
  question_count: number;
  status: string;
  email_status: string;
  emailed_to?: string | null;
  created_at: string;
  completed_at?: string | null;
  percentage?: number | null;
  recommendation?: string | null;
}

export interface AnalyticsOverview {
  total_conversations: number;
  total_messages: number;
  quizzes_completed: number;
  average_quiz_score: number;
  study_tasks_completed: number;
  study_tasks_total: number;
  topic_breakdown: { subject: string; attempts: number; mastery_percentage: number }[];
  weak_subjects: string[];
  recommendations: { title: string; description: string; action_type: string; subject: string }[];
  recent_activity: { activity_type: string; name: string; timestamp: string }[];
}

export interface GeneratedImage {
  mime_type: string;
  image_base64: string;
  model: string;
  prompt: string;
  style: string;
  aspect_ratio: string;
}

export type ActiveTab = 'chat' | 'documents' | 'quizzes' | 'interviews' | 'image_generator' | 'study_planner' | 'analytics' | 'memory';
