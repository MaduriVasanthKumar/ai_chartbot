import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.db.database import get_db

class MemoryService:

    @staticmethod
    def get_recent_conversation_messages(conversation_id: str, limit: int = 15) -> List[Dict[str, str]]:
        """Layer 1: Retrieves ordered recent messages for Gemini prompt context."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
            (conversation_id, limit)
        )
        rows = cursor.fetchall()
        conn.close()
        
        # Reverse to chronological order (oldest to newest)
        messages = [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
        return messages

    @staticmethod
    def get_user_memories(user_id: str) -> List[Dict[str, Any]]:
        """Layer 3: Retrieves long-term student memories."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, user_id, memory_type, content, source_conversation_id, confidence, created_at FROM student_memories WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def add_user_memory(user_id: str, content: str, memory_type: str = "preference", source_conversation_id: str = None) -> Dict[str, Any]:
        """Layer 3: Adds a long-term student memory."""
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()
        mem_id = f"mem_{uuid.uuid4().hex[:10]}"
        cursor.execute(
            "INSERT INTO student_memories (id, user_id, memory_type, content, source_conversation_id, confidence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (mem_id, user_id, memory_type, content, source_conversation_id, 1.0, now, now)
        )
        conn.commit()
        conn.close()
        return {
            "id": mem_id,
            "user_id": user_id,
            "memory_type": memory_type,
            "content": content,
            "source_conversation_id": source_conversation_id,
            "confidence": 1.0,
            "created_at": now
        }

    @staticmethod
    def delete_user_memory(memory_id: str, user_id: str) -> bool:
        """Deletes a specific memory with ownership validation."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM student_memories WHERE id = ? AND user_id = ?", (memory_id, user_id))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted

    @staticmethod
    def clear_all_user_memories(user_id: str) -> int:
        """Clears all long-term memories for a student."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM student_memories WHERE user_id = ?", (user_id,))
        count = cursor.rowcount
        conn.commit()
        conn.close()
        return count

    @staticmethod
    def auto_extract_memories_if_applicable(user_id: str, user_message: str, conversation_id: str):
        """Extracts facts or preferences from messages if the student explicitly shares them."""
        text = user_message.lower()
        phrases = ["my goal is ", "i am studying ", "i prefer ", "i struggle with ", "i am weak at ", "my exam is "]
        for phrase in phrases:
            if phrase in text:
                # Extract the key statement
                start = text.find(phrase)
                extracted_fact = user_message[start:start+100].strip()
                MemoryService.add_user_memory(
                    user_id=user_id,
                    content=extracted_fact,
                    memory_type="preference" if "prefer" in phrase else "goal",
                    source_conversation_id=conversation_id
                )
                break

    @staticmethod
    def summarize_conversation_if_needed(conversation_id: str):
        """Layer 4: Checks message count and summarizes older context if messages exceed 10."""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM messages WHERE conversation_id = ?", (conversation_id,))
        count = cursor.fetchone()[0]
        
        if count >= 10:
            cursor.execute("SELECT content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 6", (conversation_id,))
            old_messages = [r[0] for r in cursor.fetchall()]
            summary_text = f"Early Context Summary: The student discussed: {' | '.join(old_messages[:3])}"
            
            now = datetime.utcnow().isoformat()
            sum_id = f"sum_{uuid.uuid4().hex[:10]}"
            cursor.execute(
                "INSERT OR REPLACE INTO conversation_summaries (id, conversation_id, summary, covered_message_range, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (sum_id, conversation_id, summary_text, f"1-{len(old_messages)}", now, now)
            )
            conn.commit()
        conn.close()
