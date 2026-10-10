import { 
  BarChart2, MessageSquare, HelpCircle, CalendarCheck, 
  AlertTriangle, Sparkles, TrendingUp 
} from 'lucide-react';
import type { AnalyticsOverview } from '../types';

interface AnalyticsWorkspaceProps {
  data: AnalyticsOverview | null;
  onNavigateToTab: (tab: any) => void;
}

export const AnalyticsWorkspace: React.FC<AnalyticsWorkspaceProps> = ({ data, onNavigateToTab }) => {
  if (!data) {
    return (
      <div className="flex-1 p-6 bg-slate-900 flex items-center justify-center text-xs text-slate-400">
        Loading learning analytics...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 space-y-6">
      {/* Workspace Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-violet-400" />
          Learning Analytics & Insights
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Real-time aggregated metrics from your chat sessions, quiz scores, and completed study tasks.
        </p>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Conversations</span>
            <MessageSquare className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">{data.total_conversations}</div>
          <div className="text-[10px] text-slate-500">{data.total_messages} messages exchanged</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Quizzes Attempted</span>
            <HelpCircle className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">{data.quizzes_completed}</div>
          <div className="text-[10px] text-slate-500">Avg score: <strong className="text-violet-300">{data.average_quiz_score}%</strong></div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Study Tasks Done</span>
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-100">{data.study_tasks_completed}</div>
          <div className="text-[10px] text-slate-500">Out of {data.study_tasks_total} total tasks</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Weak Subjects</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400">{data.weak_subjects.length}</div>
          <div className="text-[10px] text-slate-500">{data.weak_subjects.join(', ') || 'None flagged!'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topic Mastery Breakdown */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            Subject Mastery Breakdown
          </h3>

          <div className="space-y-3">
            {data.topic_breakdown.map((t, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-200">
                  <span className="font-semibold">{t.subject}</span>
                  <span className="text-slate-400">{t.mastery_percentage}% Mastery</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all ${
                      t.mastery_percentage >= 80
                        ? 'bg-emerald-500'
                        : t.mastery_percentage >= 60
                        ? 'bg-violet-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${t.mastery_percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            Personalized AI Action Steps
          </h3>

          <div className="space-y-3">
            {data.recommendations.map((r, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-violet-950/30 border border-violet-500/30 text-xs space-y-2">
                <div className="font-bold text-violet-200">{r.title}</div>
                <p className="text-[11px] text-slate-400">{r.description}</p>
                <button
                  onClick={() => onNavigateToTab(r.action_type === 'quiz' ? 'quizzes' : 'chat')}
                  className="w-full py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-[11px] transition-colors"
                >
                  Take Recommended Action
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
