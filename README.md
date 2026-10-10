# EduMate AI — Advanced AI Learning Assistant for Students

EduMate AI is a production-grade, general-purpose AI learning workspace built specifically for students. It combines a ChatGPT-like conversational experience with student-focused capabilities: persistent multi-layer memory, specialized learning modes (Coding Tutor, Math Solver, Exam Prep, Concept Breakdown, Interview Prep, Research Assistant, Document Tutor), document Q&A (PDFs & Notes), AI quiz generation & evaluation, custom study planning, and real-time learning analytics.

---

## 🌟 Key Features & Complete Application Modules

### 💬 1. ChatGPT-Like Conversational Workspace
- **Multi-Turn Context Awareness:** Retains earlier conversation context for follow-up questions.
- **Conversation Sidebar:** Search sessions, rename conversations inline, delete sessions with confirmation, auto-generated titles based on message topic.
- **Rich Output Formatting:** Full Markdown rendering with syntax-highlighted code blocks, copy code/response buttons, and KaTeX mathematical equation rendering (`$e=mc^2$`).
- **Follow-up Suggestion Chips:** Contextually generated action chips at the end of AI responses to guide learning.

### 🧠 2. Persistent Multi-Layer Memory Architecture
- **Layer 1 (Current Session):** Fast recent context retrieval (up to 15 messages) passed to Gemini.
- **Layer 2 (Persistent History):** Messages and metadata stored persistently in SQL database across logouts and refreshes.
- **Layer 3 (Long-Term Student Memory):** Automatically extracts and remembers student preferences, goals, and weak subjects across sessions.
- **Layer 4 (Long Conversation Summarization):** Automatically summarizes early history when message count > 10 to manage context limits.
- **Layer 5 (Memory Manager UI):** View, add custom memories, delete single facts, or clear all memories with safety isolation.

### 🎯 3. Specialized Learning Modes
Toggle modes dynamically from the top header to adapt AI system instructions:
1. **General Chat:** Encouraging, adaptable AI tutor.
2. **Learn a Concept:** Intuitive analogies, step-by-step breakdowns, and core definitions.
3. **Coding Tutor:** Algorithm explanations, line-by-line code reviews, and $O(N)$ time & space complexity analysis.
4. **Mathematics Solver:** Step-by-step LaTeX formula derivations and common pitfall warnings.
5. **Exam Preparation:** High-yield revision cheat sheets and targeted practice questions.
6. **Interview Prep:** Mock technical and behavioral interview practice using the STAR method.
7. **Research Assistant:** Evidence-backed academic summaries with citation tags `[Source 1]`.
8. **Document Tutor:** Targeted Q&A using uploaded PDF notes.

### 📄 4. Document Library & Note Q&A
- Upload PDF files or lecture notes.
- Extracts page text using PyMuPDF / pypdf and chunks document content.
- Allows students to ask questions directly referencing page numbers and document passages.

### 📝 5. Quiz & Practice Engine
- Generate custom AI practice quizzes by specifying Subject, Topic, Difficulty (Easy, Medium, Hard), and Number of Questions.
- Interactive test-taking screen with progress indicator.
- Instant scoring, confetti celebration for high scores, and itemized reviews with correct answer explanations.
- Records historical attempts and scores.

### 📅 6. Personalized Study Planner
- Generate daily and weekly study schedules based on student goals, target exam dates, and daily available study hours.
- Interactive task checklist with completion progress bar.

### 📊 7. Real Learning Analytics
- Aggregated metrics dashboard: Total conversations, messages exchanged, quizzes completed, average quiz score %, study tasks completed.
- Subject mastery breakdown bars.
- AI personalized recommended action steps.

### 🌐 8. Multilingual & Voice Features
- Native support for **English 🇺🇸**, **Telugu 🇮🇳**, and **Hindi 🇮🇳**.
- Web Speech API integration for real-time speech-to-text input (microphone) and text-to-speech output (audio playback).

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons |
| **Markdown & Math** | react-markdown, remark-gfm, rehype-highlight, rehype-katex, KaTeX |
| **Backend** | Python 3.13, FastAPI, Uvicorn, Pydantic v2 |
| **AI Integration** | Google Gemini API (`google-genai` SDK / REST fallback) |
| **Database** | SQLite (out-of-the-box local) / PostgreSQL & Supabase (schema compatible) |
| **Document Parser** | pypdf / PyMuPDF |

---

## 📂 Project Structure

```text
edumate-ai/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints.py         # REST API routes for chat, memory, docs, quizzes, plans, analytics
│   │   ├── core/
│   │   ├── db/
│   │   │   └── database.py          # SQLite connection pool & table initializer
│   │   ├── schemas/
│   │   │   └── schemas.py           # Pydantic validation models
│   │   ├── services/
│   │   │   ├── ai_service.py        # Centralized Gemini AI orchestration & educational fallback
│   │   │   ├── memory_service.py    # Multi-layer persistent memory management
│   │   │   ├── document_service.py  # PDF text extraction & chunk Q&A
│   │   │   ├── quiz_service.py      # Quiz generation & scoring engine
│   │   │   ├── study_service.py     # Study plan generator & task tracker
│   │   │   └── analytics_service.py # Aggregated learning analytics
│   │   ├── config.py                # Environment settings
│   │   └── main.py                  # FastAPI application entry point
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.tsx          # Navigation sidebar & conversation history
│   │   │   ├── Header.tsx           # Mode selector, language options & TTS toggle
│   │   │   ├── ChatWorkspace.tsx    # Main AI chat workspace & speech input
│   │   │   ├── MessageItem.tsx      # Markdown, KaTeX & code block rendering
│   │   │   ├── DocumentWorkspace.tsx # PDF upload & note Q&A
│   │   │   ├── QuizWorkspace.tsx    # Quiz generator, test taking & review
│   │   │   ├── StudyPlannerWorkspace.tsx # Study plan generator & checklist
│   │   │   ├── AnalyticsWorkspace.tsx # Learning metrics dashboard
│   │   │   └── MemoryWorkspace.tsx  # Profile settings & memory manager
│   │   ├── services/
│   │   │   └── api.ts               # Frontend API client
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript definitions
│   │   ├── App.tsx                  # Main application state assembly
│   │   └── index.css                # Tailwind CSS & KaTeX styling
│   ├── vite.config.ts
│   └── package.json
├── database/
│   └── schema.sql                   # SQL schema definition for PostgreSQL / Supabase
├── .env.example
└── README.md
```

---

## ⚡ Quick Start & Setup Instructions

### 1. Prerequisites
- **Node.js**: v18+ (v24 tested)
- **Python**: v3.10+ (v3.13 tested)

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
To enable live Google Gemini AI calls, set your API key in `.env`:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```
*(Note: If `GEMINI_API_KEY` is not provided, EduMate AI operates seamlessly using high-quality structured educational fallback engines).*

### 3. Start Backend Server
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The FastAPI backend server runs on `http://localhost:8000`. Database tables are created automatically on startup.

### 4. Start Frontend Application
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Verification & Test Results

- **Backend Python Module Check:** Passed cleanly (`Backend modules loaded cleanly and successfully!`).
- **Frontend TypeScript Build Check:** Production bundle compiled cleanly (`tsc -b && vite build` completed with zero errors).
- **API Health Verification:** `GET http://localhost:8000/health` returned status `200 OK`.
- **Quiz Generation API Check:** `POST http://localhost:8000/api/quizzes/generate` returned structured questions, options, correct answers, and explanations.
- **Analytics Overview API Check:** `GET http://localhost:8000/api/analytics/overview` returned real aggregated database statistics.

---

## 🚀 Deployment Guide

1. **Backend (Render / Railway / Fly.io):**
   - Host directory: `/backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
   - Environment variables: `GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_PATH`

2. **Frontend (Vercel / Netlify / Cloudflare Pages):**
   - Host directory: `/frontend`
   - Build Command: `npm run build`
   - Output directory: `dist`
   - Set environment proxy or `VITE_API_URL` pointing to backend host.

3. **Database (Supabase / Managed PostgreSQL):**
   - Run `database/schema.sql` in your Supabase SQL editor to create PostgreSQL tables.
