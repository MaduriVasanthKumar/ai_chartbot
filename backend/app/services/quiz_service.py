import json
import uuid
from datetime import datetime
from typing import List, Dict, Any
from app.db.database import get_db
from app.services.ai_service import generate_structured_json

class QuizService:

    @staticmethod
    async def generate_quiz(user_id: str, subject: str, topic: str, difficulty: str = "medium", num_questions: int = 5, question_type: str = "multiple-choice") -> Dict[str, Any]:
        quiz_id = f"quiz_{uuid.uuid4().hex[:10]}"
        title = f"{subject}: {topic} Practice Quiz"
        
        prompt = (
            f"Generate a {difficulty} level practice quiz on subject '{subject}' and topic '{topic}'. "
            f"Number of questions: {num_questions}. Question type: {question_type}."
        )
        schema_desc = """
        {
          "questions": [
            {
              "id": 1,
              "question": "What is ...?",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correct_answer": "Option A",
              "explanation": "Option A is correct because..."
            }
          ]
        }
        """
        
        ai_data = await generate_structured_json(prompt, schema_desc)
        
        questions = []
        if ai_data and "questions" in ai_data and isinstance(ai_data["questions"], list):
            questions = ai_data["questions"]
        else:
            # Fallback high quality quiz template if offline/no AI key
            questions = [
                {
                    "id": 1,
                    "question": f"What is the fundamental principle of {topic} in {subject}?",
                    "options": [
                        f"Core rule defining {topic} behavior",
                        "Secondary static variable",
                        "Deprecated legacy algorithm",
                        "Unrelated system protocol"
                    ],
                    "correct_answer": f"Core rule defining {topic} behavior",
                    "explanation": f"The core rule provides the baseline logic for understanding {topic} in {subject}."
                },
                {
                    "id": 2,
                    "question": f"Which of the following best applies to {topic} problem-solving?",
                    "options": [
                        "Random guessing without validation",
                        "Structured step-by-step analysis",
                        "Ignoring edge cases",
                        "Hardcoding static responses"
                    ],
                    "correct_answer": "Structured step-by-step analysis",
                    "explanation": "Systematic step-by-step problem breakdown is the most reliable approach."
                },
                {
                    "id": 3,
                    "question": f"When evaluating performance in {subject}, what metric is most critical?",
                    "options": [
                        "Algorithmic efficiency & accuracy",
                        "Visual color contrast only",
                        "File storage extension name",
                        "Random number generation frequency"
                    ],
                    "correct_answer": "Algorithmic efficiency & accuracy",
                    "explanation": "Efficiency and correctness ensure reliable learning performance."
                }
            ]
            
        now = datetime.utcnow().isoformat()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO quizzes (id, user_id, title, subject, topic, difficulty, question_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (quiz_id, user_id, title, subject, topic, difficulty, json.dumps(questions), now)
        )
        conn.commit()
        conn.close()
        
        return {
            "id": quiz_id,
            "title": title,
            "subject": subject,
            "topic": topic,
            "difficulty": difficulty,
            "questions": questions,
            "created_at": now
        }

    @staticmethod
    def evaluate_quiz_submission(quiz_id: str, user_id: str, user_answers: Dict[str, str]) -> Dict[str, Any]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, subject, topic, question_data FROM quizzes WHERE id = ?", (quiz_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            raise ValueError("Quiz not found")
            
        questions = json.loads(row["question_data"])
        total = len(questions)
        correct_count = 0
        review = []
        
        for q in questions:
            q_id_str = str(q["id"])
            user_ans = user_answers.get(q_id_str, "").strip()
            correct_ans = q["correct_answer"].strip()
            
            is_correct = (user_ans.lower() == correct_ans.lower())
            if is_correct:
                correct_count += 1
                
            review.append({
                "question_id": q["id"],
                "question": q["question"],
                "user_answer": user_ans if user_ans else "No Answer Provided",
                "correct_answer": correct_ans,
                "is_correct": is_correct,
                "explanation": q.get("explanation", "")
            })
            
        score_percent = round((correct_count / total * 100), 1) if total > 0 else 0
        now = datetime.utcnow().isoformat()
        attempt_id = f"att_{uuid.uuid4().hex[:10]}"
        
        cursor.execute(
            "INSERT INTO quiz_attempts (id, quiz_id, user_id, answers, score, total_questions, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (attempt_id, quiz_id, user_id, json.dumps(user_answers), correct_count, total, now)
        )
        conn.commit()
        conn.close()
        
        return {
            "id": attempt_id,
            "quiz_id": quiz_id,
            "score": correct_count,
            "total_questions": total,
            "percentage": score_percent,
            "answers": user_answers,
            "completed_at": now,
            "review": review
        }

    @staticmethod
    def get_quiz_history(user_id: str) -> List[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.id, a.quiz_id, q.title, q.subject, q.topic, a.score, a.total_questions, a.completed_at
            FROM quiz_attempts a
            JOIN quizzes q ON a.quiz_id = q.id
            WHERE a.user_id = ?
            ORDER BY a.completed_at DESC
        """, (user_id,))
        rows = cursor.fetchall()
        conn.close()
        
        history = []
        for r in rows:
            score = r["score"]
            total = r["total_questions"]
            pct = round((score / total * 100), 1) if total > 0 else 0
            history.append({
                "id": r["id"],
                "quiz_id": r["quiz_id"],
                "title": r["title"],
                "subject": r["subject"],
                "topic": r["topic"],
                "score": score,
                "total_questions": total,
                "percentage": pct,
                "completed_at": r["completed_at"]
            })
        return history
