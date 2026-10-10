import json
import smtplib
import uuid
from email.message import EmailMessage
from datetime import datetime
from typing import Any, Dict, List, Tuple

from app.config import (
    SMTP_FROM_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USE_TLS,
    SMTP_USERNAME,
)
from app.db.database import get_db
from app.services.ai_service import generate_structured_json


class MockInterviewService:
    @staticmethod
    def _fallback_questions(subject: str, course: str, role: str, interview_type: str, count: int) -> List[Dict[str, Any]]:
        focus = course.strip() or subject.strip()
        role_label = role.strip() or f"{focus} professional"
        templates = [
            ("introduction", f"Give a concise introduction and explain why you want to work as a {role_label} in {focus}.", "Connect your background, motivation, and relevant evidence."),
            ("fundamentals", f"Explain the most important fundamentals of {focus} that a strong candidate should understand.", "Define the concepts clearly and connect them to practical use."),
            ("problem_solving", f"Describe a challenging {focus}-related problem you would expect in this role and walk through your solution approach.", "Look for structured reasoning, assumptions, trade-offs, and validation."),
            ("application", f"Describe a project or real-world application involving {focus}. What did you contribute and what was the outcome?", "Use specific actions, tools, measurable outcomes, and lessons learned."),
            ("scenario", f"A stakeholder gives you an unclear or changing requirement related to {focus}. How would you respond?", "Show clarification, prioritization, communication, and adaptability."),
            ("depth", f"What is one advanced topic in {focus} that you are currently improving, and how are you practicing it?", "Demonstrate honest self-awareness and a concrete learning plan."),
            ("behavioral", "Tell me about a time you received difficult feedback. How did you act on it?", "Use a clear Situation, Task, Action, Result structure."),
            ("closing", f"What questions would you ask the interviewer about this {focus} opportunity?", "Ask thoughtful questions about impact, expectations, and growth."),
        ]
        selected = templates[: max(3, min(count, len(templates)))]
        return [
            {
                "id": index + 1,
                "question": item[1],
                "category": item[0],
                "scoring_rubric": item[2],
                "ideal_answer": "A specific, structured answer with accurate concepts, reasoning, and relevant examples.",
            }
            for index, item in enumerate(selected)
        ]

    @staticmethod
    def _public_questions(questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [
            {"id": int(question.get("id", index + 1)), "question": question.get("question", ""), "category": question.get("category", "general")}
            for index, question in enumerate(questions)
        ]

    @staticmethod
    async def create_interview(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        subject = data["subject"].strip()
        course = data.get("course", "").strip()
        role = data.get("target_role", "").strip()
        interview_type = data.get("interview_type", "mixed")
        difficulty = data.get("difficulty", "medium")
        experience_level = data.get("experience_level", "student")
        count = int(data.get("question_count", 5))
        prompt = f"""Create a {count}-question AI mock interview.
Subject: {subject}
Course or specialization: {course or 'not specified'}
Target role: {role or 'not specified'}
Experience level: {experience_level}
Interview type: {interview_type}
Difficulty: {difficulty}

Mix realistic questions appropriate to the selected interview type. Each question must have a category, a private ideal_answer, and a private scoring_rubric. Return only JSON in this shape:
{{"questions":[{{"id":1,"question":"...","category":"technical|behavioral|scenario|fundamentals|mixed","ideal_answer":"...","scoring_rubric":"..."}}]}}"""
        generated = await generate_structured_json(
            prompt,
            '{"questions":[{"id":1,"question":"string","category":"string","ideal_answer":"string","scoring_rubric":"string"}]}'
        )
        questions = generated.get("questions", []) if isinstance(generated, dict) else []
        questions = [question for question in questions if isinstance(question, dict) and question.get("question")]
        if len(questions) < 3:
            questions = MockInterviewService._fallback_questions(subject, course, role, interview_type, count)
        questions = questions[: max(3, min(count, 10))]
        for index, question in enumerate(questions):
            question["id"] = index + 1
            question.setdefault("category", "mixed")
            question.setdefault("ideal_answer", "A specific, structured answer that is accurate and relevant.")
            question.setdefault("scoring_rubric", "Accuracy, clarity, reasoning, relevance, and use of examples.")

        interview_id = f"interview_{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow().isoformat()
        conn = get_db()
        conn.execute(
            """INSERT INTO mock_interviews
               (id, user_id, subject, course, target_role, experience_level,
                interview_type, difficulty, question_count, time_limit_seconds,
                questions, answers, result, status, email_status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', '{}', 'created', 'not_sent', ?)""",
            (interview_id, user_id, subject, course, role, experience_level, interview_type, difficulty, len(questions), int(data.get("time_limit_seconds", 180)), json.dumps(questions), now),
        )
        conn.commit()
        conn.close()
        return {
            "id": interview_id,
            "subject": subject,
            "course": course,
            "target_role": role,
            "experience_level": experience_level,
            "interview_type": interview_type,
            "difficulty": difficulty,
            "question_count": len(questions),
            "time_limit_seconds": int(data.get("time_limit_seconds", 180)),
            "questions": MockInterviewService._public_questions(questions),
            "status": "created",
            "email_status": "not_sent",
            "created_at": now,
            "completed_at": None,
        }

    @staticmethod
    def _fallback_evaluation(question: Dict[str, Any], answer: str) -> Dict[str, Any]:
        clean = answer.strip()
        if not clean:
            return {"score": 0, "feedback": "No answer was provided.", "strengths": [], "improvements": ["Answer the question directly and include a concrete example."]}
        score = 3 if len(clean) < 40 else 6 if len(clean) < 120 else 8
        if any(marker in clean.lower() for marker in ("because", "for example", "first", "then", "result", "impact")):
            score = min(10, score + 1)
        return {
            "score": score,
            "feedback": "Your response has a useful foundation. Add more precise evidence and explain the outcome to make it stronger.",
            "strengths": ["You attempted the question directly."],
            "improvements": ["Use a clear structure and include a specific result or measurable impact."],
        }

    @staticmethod
    async def evaluate_interview(user_id: str, interview_id: str, answers: Dict[str, str], durations: Dict[str, int]) -> Dict[str, Any]:
        conn = get_db()
        row = conn.execute("SELECT * FROM mock_interviews WHERE id = ? AND user_id = ?", (interview_id, user_id)).fetchone()
        conn.close()
        if not row:
            raise ValueError("Mock interview not found")
        interview = dict(row)
        questions = json.loads(interview["questions"])
        answer_payload = []
        for question in questions:
            question_id = str(question["id"])
            answer_payload.append({
                "question_id": question["id"],
                "question": question["question"],
                "answer": answers.get(question_id, ""),
                "ideal_answer": question.get("ideal_answer", ""),
                "scoring_rubric": question.get("scoring_rubric", ""),
                "duration_seconds": int(durations.get(question_id, 0) or 0),
            })
        evaluation = await generate_structured_json(
            "Evaluate each mock interview answer fairly from 0 to 10. Give concise feedback, strengths, and improvements. Do not invent facts. Return only JSON: " + json.dumps({"answers": answer_payload}),
            '{"question_results":[{"question_id":1,"score":0,"feedback":"string","strengths":["string"],"improvements":["string"]}]}',
        )
        generated_results = evaluation.get("question_results", []) if isinstance(evaluation, dict) else []
        by_id = {str(item.get("question_id")): item for item in generated_results if isinstance(item, dict)}
        results = []
        for item in answer_payload:
            generated = by_id.get(str(item["question_id"])) or MockInterviewService._fallback_evaluation(item, item["answer"])
            score = max(0, min(10, int(generated.get("score", 0))))
            results.append({
                "question_id": item["question_id"],
                "question": item["question"],
                "answer": item["answer"] or "No answer provided",
                "duration_seconds": item["duration_seconds"],
                "score": score,
                "max_score": 10,
                "feedback": generated.get("feedback", "Review the answer for accuracy, structure, and relevance."),
                "strengths": generated.get("strengths", []),
                "improvements": generated.get("improvements", []),
            })
        total_score = sum(item["score"] for item in results)
        percentage = round(total_score / len(results) * 10, 1) if results else 0.0
        recommendation = "Excellent readiness" if percentage >= 85 else "Strong foundation" if percentage >= 70 else "Keep practicing" if percentage >= 50 else "Build fundamentals and practice with examples"
        strengths = [strength for item in results for strength in item["strengths"]][:5]
        improvements = [improvement for item in results for improvement in item["improvements"]][:5]
        completed_at = datetime.utcnow().isoformat()
        result = {
            "overall_score": total_score,
            "max_score": len(results) * 10,
            "percentage": percentage,
            "recommendation": recommendation,
            "strengths": strengths or ["Completed the mock interview."],
            "improvements": improvements or ["Continue practicing concise, evidence-based answers."],
            "question_results": results,
            "completed_at": completed_at,
        }
        conn = get_db()
        conn.execute(
            "UPDATE mock_interviews SET answers = ?, result = ?, status = 'completed', completed_at = ? WHERE id = ? AND user_id = ?",
            (json.dumps({"answers": answers, "durations": durations}), json.dumps(result), completed_at, interview_id, user_id),
        )
        conn.commit()
        conn.close()
        return {**result, "id": interview_id, "subject": interview["subject"], "course": interview["course"], "target_role": interview["target_role"], "difficulty": interview["difficulty"], "interview_type": interview["interview_type"], "email_status": interview["email_status"], "emailed_to": interview["emailed_to"]}

    @staticmethod
    def get_history(user_id: str) -> List[Dict[str, Any]]:
        conn = get_db()
        rows = conn.execute("""SELECT id, subject, course, target_role, experience_level, interview_type, difficulty, question_count, status, email_status, emailed_to, created_at, completed_at, result FROM mock_interviews WHERE user_id = ? ORDER BY created_at DESC""", (user_id,)).fetchall()
        conn.close()
        history = []
        for row in rows:
            item = dict(row)
            result = json.loads(item.pop("result") or "{}")
            item["percentage"] = result.get("percentage")
            item["recommendation"] = result.get("recommendation")
            history.append(item)
        return history

    @staticmethod
    def get_detail(user_id: str, interview_id: str) -> Dict[str, Any]:
        conn = get_db()
        row = conn.execute("SELECT * FROM mock_interviews WHERE id = ? AND user_id = ?", (interview_id, user_id)).fetchone()
        conn.close()
        if not row:
            raise ValueError("Mock interview not found")
        item = dict(row)
        item["questions"] = MockInterviewService._public_questions(json.loads(item.pop("questions") or "[]"))
        item["answers"] = json.loads(item.pop("answers") or "{}")
        item["result"] = json.loads(item.pop("result") or "{}")
        return item

    @staticmethod
    def _format_report(email: str, detail: Dict[str, Any]) -> str:
        result = detail.get("result", {})
        lines = [
            "EduMate AI Mock Interview Report",
            "=" * 34,
            f"Subject: {detail.get('subject', '')}",
            f"Course: {detail.get('course') or 'Not specified'}",
            f"Target role: {detail.get('target_role') or 'Not specified'}",
            f"Difficulty: {detail.get('difficulty', '')}",
            f"Overall score: {result.get('percentage', 0)}%",
            f"Recommendation: {result.get('recommendation', '')}",
            "",
            "Strengths:",
        ]
        lines.extend(f"- {item}" for item in result.get("strengths", []))
        lines.append("\nImprovement areas:")
        lines.extend(f"- {item}" for item in result.get("improvements", []))
        lines.append("\nQuestion feedback:")
        for item in result.get("question_results", []):
            lines.extend([f"\n{item.get('question_id')}. {item.get('question')}", f"Score: {item.get('score')}/10", f"Feedback: {item.get('feedback')}"])
        lines.append(f"\nThis report was requested for the signed-in account: {email}")
        return "\n".join(lines)

    @staticmethod
    def send_report(user: Dict[str, Any], interview_id: str) -> Tuple[bool, str, str]:
        email = user["email"]
        detail = MockInterviewService.get_detail(user["id"], interview_id)
        if detail.get("status") != "completed" or not detail.get("result", {}).get("question_results"):
            raise ValueError("Complete the interview before sending its report")
        if not SMTP_HOST or not SMTP_FROM_EMAIL:
            return False, "SMTP is not configured. Add SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, and SMTP_FROM_EMAIL to .env.", email
        message = EmailMessage()
        message["Subject"] = f"EduMate AI Mock Interview Report — {detail.get('subject', 'Interview')}"
        message["From"] = SMTP_FROM_EMAIL
        message["To"] = email
        message.set_content(MockInterviewService._format_report(email, detail))
        try:
            if SMTP_USE_TLS:
                with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
                    server.starttls()
                    if SMTP_USERNAME and SMTP_PASSWORD:
                        server.login(SMTP_USERNAME, SMTP_PASSWORD)
                    server.send_message(message)
            else:
                with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as server:
                    if SMTP_USERNAME and SMTP_PASSWORD:
                        server.login(SMTP_USERNAME, SMTP_PASSWORD)
                    server.send_message(message)
        except Exception as error:
            return False, f"Email delivery failed: {error}", email
        conn = get_db()
        conn.execute("UPDATE mock_interviews SET email_status = 'sent', emailed_to = ? WHERE id = ? AND user_id = ?", (email, interview_id, user["id"]))
        conn.commit()
        conn.close()
        return True, "Interview report sent successfully.", email
