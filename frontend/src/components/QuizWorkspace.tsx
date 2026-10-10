import { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  HelpCircle, Sparkles, Trophy, CheckCircle2, XCircle, ListChecks 
} from 'lucide-react';
import type { Quiz, QuizAttempt } from '../types';
import { generateQuiz, submitQuiz } from '../services/api';

interface QuizWorkspaceProps {
  history: QuizAttempt[];
  onQuizCompleted: () => void;
}

export const QuizWorkspace: React.FC<QuizWorkspaceProps> = ({ history, onQuizCompleted }) => {
  const [subject, setSubject] = useState('Computer Science');
  const [topic, setTopic] = useState('Data Structures');
  const [difficulty, setDifficulty] = useState('medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [activeAttemptResult, setActiveAttemptResult] = useState<QuizAttempt | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !topic.trim()) return;

    try {
      setIsGenerating(true);
      setActiveAttemptResult(null);
      setUserAnswers({});
      setCurrentQuestionIdx(0);
      const newQuiz = await generateQuiz(subject, topic, difficulty, numQuestions);
      setActiveQuiz(newQuiz);
    } catch (e) {
      alert("Failed to generate quiz");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectAnswer = (qId: number, option: string) => {
    setUserAnswers(prev => ({ ...prev, [String(qId)]: option }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    try {
      const result = await submitQuiz(activeQuiz.id, userAnswers);
      setActiveAttemptResult(result);

      if (result.percentage >= 70) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }

      onQuizCompleted();
    } catch (e) {
      alert("Failed to submit quiz");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 space-y-6">
      {/* Workspace Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-violet-400" />
          Quiz & Practice Engine
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Generate custom AI practice quizzes on any subject or topic to test your recall and master difficult concepts.
        </p>
      </div>

      {/* State 1: Active Test Taking Screen */}
      {activeQuiz && !activeAttemptResult && (
        <div className="max-w-2xl mx-auto p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-100">{activeQuiz.title}</h3>
              <p className="text-xs text-slate-400">Difficulty: <span className="capitalize text-violet-400 font-medium">{activeQuiz.difficulty}</span></p>
            </div>
            <div className="text-xs text-violet-300 bg-violet-950/60 border border-violet-500/30 px-3 py-1 rounded-full font-semibold">
              Question {currentQuestionIdx + 1} of {activeQuiz.questions.length}
            </div>
          </div>

          {/* Question Card */}
          {(() => {
            const q = activeQuiz.questions[currentQuestionIdx];
            if (!q) return null;
            const selectedOpt = userAnswers[String(q.id)];

            return (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-100 leading-relaxed">
                  {q.id}. {q.question}
                </h4>

                <div className="space-y-2">
                  {q.options?.map((opt: string, idx: number) => {
                    const isSelected = selectedOpt === opt;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectAnswer(q.id, opt)}
                        className={`w-full p-3 rounded-xl text-left text-xs transition-all flex items-center gap-3 border ${
                          isSelected
                            ? 'bg-violet-600/20 text-violet-200 border-violet-500'
                            : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-violet-400 bg-violet-500' : 'border-slate-600'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Navigation & Submit Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              disabled={currentQuestionIdx === 0}
              onClick={() => setCurrentQuestionIdx((prev: number) => prev - 1)}
              className="py-1.5 px-4 rounded-lg bg-slate-800 text-slate-300 text-xs disabled:opacity-40"
            >
              Previous
            </button>

            {currentQuestionIdx === activeQuiz.questions.length - 1 ? (
              <button
                onClick={handleSubmitQuiz}
                className="py-2 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all"
              >
                Submit Quiz
              </button>
            ) : (
              <button
                onClick={() => setCurrentQuestionIdx((prev: number) => prev + 1)}
                className="py-1.5 px-4 rounded-lg bg-violet-600 text-white text-xs font-medium"
              >
                Next Question
              </button>
            )}
          </div>
        </div>
      )}

      {/* State 2: Quiz Score & Review Screen */}
      {activeAttemptResult && (
        <div className="max-w-2xl mx-auto p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-6 shadow-xl text-center">
          <div className="w-16 h-16 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center mx-auto text-violet-400">
            <Trophy className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-100">Quiz Completed!</h3>
            <p className="text-xs text-slate-400">Here is your detailed performance analysis</p>
          </div>

          <div className="inline-block p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="text-3xl font-extrabold text-violet-400">
              {activeAttemptResult.percentage}%
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Score: {activeAttemptResult.score} / {activeAttemptResult.total_questions} Correct
            </div>
          </div>

          {/* Detailed Question Review */}
          <div className="text-left space-y-3 pt-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Question Breakdown</h4>
            {activeAttemptResult.review?.map((r: any, idx: number) => (
              <div key={idx} className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                r.is_correct ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'
              }`}>
                <div className="flex items-start gap-2 font-semibold text-slate-200">
                  {r.is_correct ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                  <span>{r.question_id}. {r.question}</span>
                </div>

                <div className="pl-6 space-y-1 text-slate-300">
                  <div>Your Answer: <span className={r.is_correct ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>{r.user_answer}</span></div>
                  {!r.is_correct && <div>Correct Answer: <span className="text-emerald-400 font-medium">{r.correct_answer}</span></div>}
                  <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">💡 Explanation: {r.explanation}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => { setActiveQuiz(null); setActiveAttemptResult(null); }}
            className="py-2 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
          >
            Create Another Quiz
          </button>
        </div>
      )}

      {/* State 3: Quiz Generator Form */}
      {!activeQuiz && !activeAttemptResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleGenerate} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Generate AI Quiz
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Computer Science, Math, Physics"
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Binary Search Trees, Derivatives"
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Questions</label>
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isGenerating ? 'Generating Quiz...' : 'Start Practice Quiz'}
            </button>
          </form>

          {/* Historical Attempts Table */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-violet-400" />
              Quiz History & Scores
            </h3>

            {history.length === 0 ? (
              <div className="text-xs text-slate-500 p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800">
                No past quiz attempts recorded. Complete your first quiz to track your scores!
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{h.title}</div>
                      <div className="text-[10px] text-slate-400">{h.subject} • {h.topic}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`font-bold ${h.percentage >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {h.percentage}%
                        </div>
                        <div className="text-[10px] text-slate-500">{h.score}/{h.total_questions} Correct</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
