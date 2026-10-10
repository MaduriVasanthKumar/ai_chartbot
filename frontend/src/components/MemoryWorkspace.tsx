import { useState } from 'react';
import { Brain, Trash2, Plus, User, ShieldCheck, Check } from 'lucide-react';
import type { StudentMemory, Profile } from '../types';
import { updateProfile, addMemory, deleteMemory, clearAllMemories } from '../services/api';

interface MemoryWorkspaceProps {
  profile: Profile | null;
  memories: StudentMemory[];
  onProfileUpdated: () => void;
  onMemoriesUpdated: () => void;
}

export const MemoryWorkspace: React.FC<MemoryWorkspaceProps> = ({
  profile,
  memories,
  onProfileUpdated,
  onMemoriesUpdated,
}) => {
  const [displayName, setDisplayName] = useState(profile?.display_name || 'Alex Learner');
  const [academicLevel, setAcademicLevel] = useState(profile?.academic_level || 'Undergraduate');
  const [prefLang, setPrefLang] = useState(profile?.preferred_language || 'en');
  const [explanationStyle, setExplanationStyle] = useState(profile?.learning_preferences?.explanation_style || 'step-by-step with analogies');

  const [newMemoryText, setNewMemoryText] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSavedSuccess, setProfileSavedSuccess] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingProfile(true);
      await updateProfile({
        display_name: displayName,
        academic_level: academicLevel,
        preferred_language: prefLang,
        learning_preferences: { explanation_style: explanationStyle }
      });
      onProfileUpdated();
      setProfileSavedSuccess(true);
      setTimeout(() => setProfileSavedSuccess(false), 2500);
    } catch (e) {
      alert("Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;
    try {
      await addMemory(newMemoryText.trim(), 'preference');
      setNewMemoryText('');
      onMemoriesUpdated();
    } catch (e) {
      alert("Failed to add memory");
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await deleteMemory(id);
      onMemoriesUpdated();
    } catch (e) {
      alert("Failed to delete memory");
    }
  };

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear all remembered student facts?")) {
      try {
        await clearAllMemories();
        onMemoriesUpdated();
      } catch (e) {
        alert("Failed to clear memories");
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 space-y-6">
      {/* Workspace Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Brain className="w-6 h-6 text-violet-400" />
          Student Profile & Persistent Memory
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          EduMate AI maintains persistent long-term memory across sessions. You can view, edit, or delete any remembered preferences at any time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student Profile Form */}
        <form onSubmit={handleSaveProfile} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <User className="w-4 h-4 text-violet-400" />
            Academic Profile Settings
          </h3>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Academic Level</label>
              <select
                value={academicLevel}
                onChange={(e) => setAcademicLevel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
              >
                <option value="High School">High School</option>
                <option value="Undergraduate">Undergraduate</option>
                <option value="Graduate">Graduate</option>
                <option value="Self-Learner">Self-Learner</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Preferred Language</label>
              <select
                value={prefLang}
                onChange={(e) => setPrefLang(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
              >
                <option value="en">English 🇺🇸</option>
                <option value="te">Telugu 🇮🇳</option>
                <option value="hi">Hindi 🇮🇳</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Preferred Explanation Style</label>
            <input
              type="text"
              value={explanationStyle}
              onChange={(e) => setExplanationStyle(e.target.value)}
              placeholder="e.g. step-by-step with real world analogies"
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingProfile}
            className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center gap-2"
          >
            {profileSavedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Saved Successfully!</span>
              </>
            ) : (
              <span>Save Profile Preferences</span>
            )}
          </button>
        </form>

        {/* Persistent Long-Term Memory Manager */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-400" />
                  Remembered Student Facts ({memories.length})
                </h3>
                <p className="text-[11px] text-slate-400">AI automatically remembers relevant goals and preferences across chats.</p>
              </div>

              {memories.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Add Custom Memory Input */}
            <form onSubmit={handleAddMemory} className="flex gap-2">
              <input
                type="text"
                value={newMemoryText}
                onChange={(e) => setNewMemoryText(e.target.value)}
                placeholder="Add custom remembered fact..."
                className="flex-1 px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                className="py-1.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>

            {/* Memory Items List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {memories.length === 0 ? (
                <div className="text-xs text-slate-500 p-6 text-center bg-slate-900/40 rounded-xl border border-slate-800">
                  No remembered facts yet. As you chat, EduMate AI will automatically store your key learning goals!
                </div>
              ) : (
                memories.map((m) => (
                  <div key={m.id} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-slate-200 truncate">{m.content}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteMemory(m.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
