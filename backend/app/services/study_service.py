import json
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any
from app.db.database import get_db

class StudyService:

    @staticmethod
    def generate_study_plan(user_id: str, goal: str, subjects: List[str], exam_date: str, available_hours_per_day: float = 2.0) -> Dict[str, Any]:
        plan_id = f"plan_{uuid.uuid4().hex[:10]}"
        title = f"Study Plan: {goal[:40]}"
        
        start_dt = datetime.utcnow()
        try:
            exam_dt = datetime.fromisoformat(exam_date.replace("Z", ""))
        except Exception:
            exam_dt = start_dt + timedelta(days=7)
            
        start_str = start_dt.strftime("%Y-%m-%d")
        end_str = exam_dt.strftime("%Y-%m-%d")
        
        days_diff = max(1, (exam_dt - start_dt).days)
        tasks = []
        
        # Build tasks spread across available days for specified subjects
        for day_idx in range(min(days_diff, 14)):  # max 2 week plan schedule
            task_date = (start_dt + timedelta(days=day_idx)).strftime("%Y-%m-%d")
            subj = subjects[day_idx % len(subjects)] if subjects else "General Study"
            
            task_id = f"task_{uuid.uuid4().hex[:10]}"
            minutes = int(available_hours_per_day * 30) # split into 30 min focused modules
            
            task_title = f"Focus Module {day_idx + 1}: Master {subj} core concepts & practice problem set"
            tasks.append({
                "id": task_id,
                "study_plan_id": plan_id,
                "title": task_title,
                "subject": subj,
                "scheduled_date": task_date,
                "estimated_minutes": minutes,
                "status": "pending",
                "completed_at": None
            })
            
        now = datetime.utcnow().isoformat()
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO study_plans (id, user_id, title, goal, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (plan_id, user_id, title, goal, start_str, end_str, now)
        )
        
        for t in tasks:
            cursor.execute(
                "INSERT INTO study_tasks (id, study_plan_id, title, subject, scheduled_date, estimated_minutes, status, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (t["id"], plan_id, t["title"], t["subject"], t["scheduled_date"], t["estimated_minutes"], t["status"], t["completed_at"])
            )
            
        conn.commit()
        conn.close()
        
        return {
            "id": plan_id,
            "title": title,
            "goal": goal,
            "start_date": start_str,
            "end_date": end_str,
            "tasks": tasks,
            "progress_percentage": 0.0,
            "created_at": now
        }

    @staticmethod
    def get_user_study_plans(user_id: str) -> List[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, goal, start_date, end_date, created_at FROM study_plans WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
        plan_rows = cursor.fetchall()
        
        plans = []
        for p in plan_rows:
            p_id = p["id"]
            cursor.execute("SELECT id, study_plan_id, title, subject, scheduled_date, estimated_minutes, status, completed_at FROM study_tasks WHERE study_plan_id = ? ORDER BY scheduled_date ASC", (p_id,))
            task_rows = cursor.fetchall()
            
            tasks = [dict(t) for t in task_rows]
            completed_count = sum(1 for t in tasks if t["status"] == "completed")
            pct = round((completed_count / len(tasks) * 100), 1) if tasks else 0.0
            
            plans.append({
                "id": p_id,
                "title": p["title"],
                "goal": p["goal"],
                "start_date": p["start_date"],
                "end_date": p["end_date"],
                "tasks": tasks,
                "progress_percentage": pct,
                "created_at": p["created_at"]
            })
            
        conn.close()
        return plans

    @staticmethod
    def update_task_status(task_id: str, status: str) -> Dict[str, Any]:
        conn = get_db()
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat() if status == "completed" else None
        
        cursor.execute("UPDATE study_tasks SET status = ?, completed_at = ? WHERE id = ?", (status, now, task_id))
        conn.commit()
        
        cursor.execute("SELECT id, study_plan_id, title, subject, scheduled_date, estimated_minutes, status, completed_at FROM study_tasks WHERE id = ?", (task_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise ValueError("Task not found")
        return dict(row)
