import { useState } from 'react';
import { Calendar, CheckCircle2, Circle, Clock, Plus, Sparkles } from 'lucide-react';
import type { StudyPlan, StudyTask } from '../types';
import { generateStudyPlan, updateStudyTaskStatus } from '../services/api';

interface StudyPlannerWorkspaceProps {
  plans: StudyPlan[];
  onPlanCreated: () => void;
}

export const StudyPlannerWorkspace: React.FC<StudyPlannerWorkspaceProps> = ({ plans, onPlanCreated }) => {
  const [goal, setGoal] = useState('Master Data Structures & Calculus before finals');
  const [subjectsStr, setSubjectsStr] = useState('Computer Science, Mathematics, Physics');
  const [examDate, setExamDate] = useState('2026-10-25');
  const [hoursPerDay, setHoursPerDay] = useState(2.0);
  const [isGenerating, setIsGenerating] = useState(false);

  const activePlan = plans.length > 0 ? plans[0] : null;

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || !subjectsStr.trim()) return;

    try {
      setIsGenerating(true);
      const subjs = subjectsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
      await generateStudyPlan(goal, subjs, examDate, hoursPerDay);
      onPlanCreated();
    } catch (e) {
      alert("Failed to generate study plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleTask = async (task: StudyTask) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateStudyTaskStatus(task.id, nextStatus);
      onPlanCreated();
    } catch (e) {
      alert("Failed to update task status");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 space-y-6">
      {/* Workspace Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-violet-400" />
          Personalized Study Planner
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Specify your learning goals and exam deadlines. EduMate AI constructs a structured daily and weekly schedule tailored to your available time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator Form */}
        <form onSubmit={handleGeneratePlan} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            Create AI Study Plan
          </h3>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Learning Goal / Exam Target</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Master Calculus & Algorithms"
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Subjects (comma separated)</label>
            <input
              type="text"
              value={subjectsStr}
              onChange={(e) => setSubjectsStr(e.target.value)}
              placeholder="Computer Science, Mathematics, Physics"
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Exam Target Date</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Daily Study Hours</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="8.0"
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{isGenerating ? 'Building Schedule...' : 'Generate New Study Plan'}</span>
          </button>
        </form>

        {/* Active Schedule & Tasks List */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          {!activePlan ? (
            <div className="text-xs text-slate-500 p-12 text-center bg-slate-900/40 rounded-xl border border-slate-800">
              No active study plan. Fill out the form to generate your custom AI daily study schedule!
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{activePlan.title}</h3>
                  <p className="text-xs text-slate-400">Target Goal: {activePlan.goal}</p>
                </div>

                <div className="text-right">
                  <div className="text-lg font-extrabold text-violet-400">{activePlan.progress_percentage}%</div>
                  <div className="text-[10px] text-slate-500">Progress Completed</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-violet-600 to-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${activePlan.progress_percentage}%` }}
                />
              </div>

              {/* Tasks List */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scheduled Study Modules</h4>
                {activePlan.tasks.map((task) => {
                  const isDone = task.status === 'completed';
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleToggleTask(task)}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                        isDone
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-400 line-through'
                          : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-violet-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button className="text-slate-400 hover:text-violet-400">
                          {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-slate-500" />}
                        </button>
                        <div>
                          <div className="font-medium">{task.title}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                            <span>Subject: {task.subject}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {task.estimated_minutes} mins</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {task.scheduled_date}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
