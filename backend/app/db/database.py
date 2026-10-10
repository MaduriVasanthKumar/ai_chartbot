import sqlite3
import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.config import DATABASE_PATH

def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
    );
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        academic_level TEXT DEFAULT 'Undergraduate',
        preferred_language TEXT DEFAULT 'en',
        learning_preferences TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        mode TEXT DEFAULT 'general',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS conversation_summaries (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        covered_message_range TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        memory_type TEXT DEFAULT 'preference',
        content TEXT NOT NULL,
        source_conversation_id TEXT,
        confidence REAL DEFAULT 1.0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_type TEXT DEFAULT 'pdf',
        storage_path TEXT DEFAULT '',
        processing_status TEXT DEFAULT 'completed',
        summary TEXT DEFAULT '',
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_text TEXT NOT NULL,
        page_number INTEGER DEFAULT 1,
        chunk_index INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        topic TEXT NOT NULL,
        difficulty TEXT DEFAULT 'medium',
        question_data TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quiz_attempts (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        answers TEXT NOT NULL,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        completed_at TEXT NOT NULL,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mock_interviews (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        course TEXT DEFAULT '',
        target_role TEXT DEFAULT '',
        experience_level TEXT DEFAULT 'student',
        interview_type TEXT DEFAULT 'mixed',
        difficulty TEXT DEFAULT 'medium',
        question_count INTEGER DEFAULT 5,
        time_limit_seconds INTEGER DEFAULT 180,
        questions TEXT NOT NULL,
        answers TEXT DEFAULT '{}',
        result TEXT DEFAULT '{}',
        status TEXT DEFAULT 'created',
        email_status TEXT DEFAULT 'not_sent',
        emailed_to TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS study_plans (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        goal TEXT DEFAULT '',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS study_tasks (
        id TEXT PRIMARY KEY,
        study_plan_id TEXT NOT NULL,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        estimated_minutes INTEGER DEFAULT 30,
        status TEXT DEFAULT 'pending',
        completed_at TEXT,
        FOREIGN KEY (study_plan_id) REFERENCES study_plans(id) ON DELETE CASCADE
    );
    """)

    conn.commit()

    # Seed default student profile if empty
    cursor.execute("SELECT COUNT(*) FROM profiles")
    if cursor.fetchone()[0] == 0:
        now = datetime.utcnow().isoformat()
        cursor.execute(
            "INSERT INTO profiles (id, display_name, academic_level, preferred_language, learning_preferences, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("default_user", "Alex Learner", "Undergraduate", "en", json.dumps({"explanation_style": "step-by-step with examples", "interests": ["Computer Science", "Mathematics", "AI"]}), now, now)
        )
        conn.commit()

    conn.close()
