import type {
  Profile, Conversation, Message, StudentMemory, DocumentItem,
  Quiz, QuizAttempt, StudyPlan, AnalyticsOverview, AuthResponse, AuthUser,
  MockInterview, MockInterviewResult, MockInterviewHistoryItem, GeneratedImage
} from '../types';

const API_BASE = '/api';
const TOKEN_KEY = 'edumate_access_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path: string, init: RequestInit = {}, authenticated = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (authenticated) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 401 && authenticated) {
    clearAccessToken();
    window.dispatchEvent(new Event('auth-expired'));
  }
  return response;
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json() as { detail?: string };
    return data.detail || fallback;
  } catch {
    return fallback;
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }, false);
  if (!res.ok) throw new Error(await errorMessage(res, 'Invalid email or password'));
  const data = await res.json() as AuthResponse;
  saveAccessToken(data.access_token);
  return data;
}

export async function register(email: string, password: string, displayName: string): Promise<AuthResponse> {
  const res = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName })
  }, false);
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not create your account'));
  const data = await res.json() as AuthResponse;
  saveAccessToken(data.access_token);
  return data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await request('/auth/me');
  if (!res.ok) throw new Error(await errorMessage(res, 'Your session has expired'));
  return res.json();
}

export async function logout(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    clearAccessToken();
  }
}

export async function fetchProfile(): Promise<Profile> {
  const res = await request('/profile');
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

export async function updateProfile(data: Partial<Profile>): Promise<Profile> {
  const res = await request('/profile', { method: 'PATCH', body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await request('/conversations');
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json();
}

export async function createConversation(title = 'New Study Session', mode = 'general'): Promise<Conversation> {
  const res = await request('/conversations', {
    method: 'POST',
    body: JSON.stringify({ title, mode })
  });
  if (!res.ok) throw new Error('Failed to create conversation');
  return res.json();
}

export async function fetchConversationDetails(id: string): Promise<Conversation> {
  const res = await request(`/conversations/${id}`);
  if (!res.ok) throw new Error('Failed to fetch conversation details');
  return res.json();
}

export async function updateConversationTitle(id: string, title: string): Promise<Conversation> {
  const res = await request(`/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title })
  });
  if (!res.ok) throw new Error('Failed to update conversation');
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await request(`/conversations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete conversation');
}

export async function sendMessage(
  conversationId: string,
  content: string,
  mode = 'general',
  language = 'en',
  documentId?: string,
  webSearch?: boolean
): Promise<{ user_message: Message; assistant_message: Message }> {
  const res = await request(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, mode, language, document_id: documentId, web_search: webSearch })
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to send message'));
  return res.json();
}

export async function fetchMemories(): Promise<StudentMemory[]> {
  const res = await request('/memories');
  if (!res.ok) throw new Error('Failed to fetch memories');
  return res.json();
}

export async function addMemory(content: string, memoryType = 'preference'): Promise<StudentMemory> {
  const res = await request('/memories', {
    method: 'POST',
    body: JSON.stringify({ content, memory_type: memoryType })
  });
  if (!res.ok) throw new Error('Failed to add memory');
  return res.json();
}

export async function deleteMemory(id: string): Promise<void> {
  const res = await request(`/memories/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete memory');
}

export async function clearAllMemories(): Promise<void> {
  const res = await request('/memories', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear memories');
}

export async function uploadDocument(file: File): Promise<DocumentItem> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await request('/documents/upload', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Failed to upload document');
  return res.json();
}

export async function fetchDocuments(): Promise<DocumentItem[]> {
  const res = await request('/documents');
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function generateQuiz(
  subject: string,
  topic: string,
  difficulty = 'medium',
  numQuestions = 5,
  questionType = 'multiple-choice'
): Promise<Quiz> {
  const res = await request('/quizzes/generate', {
    method: 'POST',
    body: JSON.stringify({ subject, topic, difficulty, num_questions: numQuestions, question_type: questionType })
  });
  if (!res.ok) throw new Error('Failed to generate quiz');
  return res.json();
}

export async function submitQuiz(quizId: string, answers: Record<string, string>): Promise<QuizAttempt> {
  const res = await request(`/quizzes/${quizId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers })
  });
  if (!res.ok) throw new Error('Failed to submit quiz');
  return res.json();
}

export async function fetchQuizHistory(): Promise<QuizAttempt[]> {
  const res = await request('/quizzes/history');
  if (!res.ok) throw new Error('Failed to fetch quiz history');
  return res.json();
}

export async function generateStudyPlan(
  goal: string,
  subjects: string[],
  examDate: string,
  hoursPerDay = 2.0
): Promise<StudyPlan> {
  const res = await request('/study-plans/generate', {
    method: 'POST',
    body: JSON.stringify({ goal, subjects, exam_date: examDate, available_hours_per_day: hoursPerDay })
  });
  if (!res.ok) throw new Error('Failed to generate study plan');
  return res.json();
}

export async function fetchStudyPlans(): Promise<StudyPlan[]> {
  const res = await request('/study-plans');
  if (!res.ok) throw new Error('Failed to fetch study plans');
  return res.json();
}

export async function updateStudyTaskStatus(taskId: string, status: string): Promise<void> {
  const res = await request(`/study-tasks/${taskId}?status=${encodeURIComponent(status)}`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Failed to update task status');
}

export async function createMockInterview(data: {
  subject: string;
  course: string;
  target_role: string;
  experience_level: string;
  interview_type: string;
  difficulty: string;
  question_count: number;
  time_limit_seconds: number;
}): Promise<MockInterview> {
  const res = await request('/mock-interviews', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to create mock interview'));
  return res.json();
}

export async function evaluateMockInterview(
  interviewId: string,
  answers: Record<string, string>,
  durations: Record<string, number>
): Promise<MockInterviewResult> {
  const res = await request(`/mock-interviews/${interviewId}/evaluate`, {
    method: 'POST',
    body: JSON.stringify({ answers, durations })
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to evaluate mock interview'));
  return res.json();
}

export async function fetchMockInterviewHistory(): Promise<MockInterviewHistoryItem[]> {
  const res = await request('/mock-interviews');
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to fetch interview history'));
  return res.json();
}

export async function fetchMockInterview(interviewId: string): Promise<MockInterviewResult> {
  const res = await request(`/mock-interviews/${interviewId}`);
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to fetch interview result'));
  const data = await res.json() as {
    result: MockInterviewResult;
    id: string;
    subject: string;
    course: string;
    target_role: string;
    difficulty: string;
    interview_type: string;
    email_status: string;
    emailed_to?: string | null;
  };
  return {
    ...data.result,
    id: data.id,
    subject: data.subject,
    course: data.course,
    target_role: data.target_role,
    difficulty: data.difficulty,
    interview_type: data.interview_type,
    email_status: data.email_status,
    emailed_to: data.emailed_to
  };
}

export async function emailMockInterviewReport(interviewId: string): Promise<{ sent: boolean; message: string; email: string }> {
  const res = await request(`/mock-interviews/${interviewId}/email`, { method: 'POST' });
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to send interview report'));
  return res.json();
}

export async function generateImage(
  prompt: string,
  style = 'educational illustration',
  aspectRatio = '1:1'
): Promise<GeneratedImage> {
  const res = await request('/images/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, style, aspect_ratio: aspectRatio })
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not generate the image'));
  return res.json();
}

export async function fetchAnalytics(): Promise<AnalyticsOverview> {
  const res = await request('/analytics/overview');
  if (!res.ok) throw new Error('Failed to fetch analytics overview');
  return res.json();
}
