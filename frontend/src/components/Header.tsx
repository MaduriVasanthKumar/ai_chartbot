import React from 'react';
import { 
  Menu, Globe, Volume2, VolumeX, Brain, ChevronDown, Moon, Sun,
  Lightbulb, Code, Calculator, GraduationCap, Briefcase, Search, FileText
} from 'lucide-react';
import type { ActiveTab } from '../types';

interface HeaderProps {
  mode: string;
  language: string;
  ttsEnabled: boolean;
  activeTab: ActiveTab;
  memoryCount: number;
  theme: 'dark' | 'light';
  onToggleSidebar: () => void;
  onModeChange: (mode: string) => void;
  onLanguageChange: (lang: string) => void;
  onToggleTTS: () => void;
  onOpenMemoryTab: () => void;
  onThemeChange: (theme: 'dark' | 'light') => void;
}

const MODES = [
  { id: 'general', label: 'General Chat', icon: Lightbulb, desc: 'Everyday study helper' },
  { id: 'concept', label: 'Learn a Concept', icon: Lightbulb, desc: 'Intuitive analogies & breakdown' },
  { id: 'coding', label: 'Coding Tutor', icon: Code, desc: 'Code logic, debugging & complexity' },
  { id: 'math', label: 'Mathematics Solver', icon: Calculator, desc: 'Step-by-step LaTeX formulas' },
  { id: 'exam', label: 'Exam Preparation', icon: GraduationCap, desc: 'High-yield cheat sheets & questions' },
  { id: 'interview', label: 'Interview Prep', icon: Briefcase, desc: 'STAR technique & technical Q&A' },
  { id: 'research', label: 'Research Assistant', icon: Search, desc: 'Evidence-backed summaries & citations' },
  { id: 'document', label: 'Document Tutor', icon: FileText, desc: 'Q&A on uploaded notes & PDFs' },
];

export const Header: React.FC<HeaderProps> = ({
  mode,
  language,
  ttsEnabled,
  activeTab,
  memoryCount,
  theme,
  onToggleSidebar,
  onModeChange,
  onLanguageChange,
  onToggleTTS,
  onOpenMemoryTab,
  onThemeChange,
}) => {
  const activeModeObj = MODES.find(m => m.id === mode) || MODES[0];
  const IconComp = activeModeObj.icon;

  return (
    <header className="h-14 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-400 hover:text-slate-100 md:hidden rounded-lg hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mode Selector Dropdown */}
        {activeTab === 'chat' && (
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-200 text-xs font-medium border border-slate-700 transition-colors">
              <IconComp className="w-4 h-4 text-violet-400" />
              <span>{activeModeObj.label}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <div className="absolute top-full left-0 mt-1.5 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 hidden group-hover:block z-50">
              <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Select Learning Mode
              </div>
              {MODES.map((m) => {
                const MIcon = m.icon;
                const isSelected = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => onModeChange(m.id)}
                    className={`w-full p-2 rounded-lg text-left text-xs flex items-start gap-2.5 transition-colors ${
                      isSelected ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <MIcon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-violet-400' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-medium text-slate-200">{m.label}</div>
                      <div className="text-[10px] text-slate-400">{m.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right Header Toolbar */}
      <div className="flex items-center gap-2">
        {/* Persistent Memory Status Pill */}
        <button
          onClick={onOpenMemoryTab}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-950/60 border border-violet-500/30 text-violet-300 text-xs hover:bg-violet-900/40 transition-colors"
          title="Click to view remembered student facts"
        >
          <Brain className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[11px] font-medium">{memoryCount} Memory Facts</span>
        </button>

        {/* Black / White theme modes */}
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-800 p-0.5" role="group" aria-label="Theme mode">
          <button
            type="button"
            onClick={() => onThemeChange('dark')}
            aria-pressed={theme === 'dark'}
            title="Black mode"
            className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
              theme === 'dark'
                ? 'bg-slate-950 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Black</span>
          </button>
          <button
            type="button"
            onClick={() => onThemeChange('light')}
            aria-pressed={theme === 'light'}
            title="White mode"
            className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
              theme === 'light'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">White</span>
          </button>
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs text-slate-300">
          <Globe className="w-3.5 h-3.5 ml-1.5 text-slate-400" />
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="bg-transparent text-slate-200 text-xs px-1.5 py-1 focus:outline-none cursor-pointer"
          >
            <option value="en" className="bg-slate-900">English 🇺🇸</option>
            <option value="te" className="bg-slate-900">Telugu 🇮🇳</option>
            <option value="hi" className="bg-slate-900">Hindi 🇮🇳</option>
          </select>
        </div>

        {/* Text To Speech Audio Toggle */}
        <button
          onClick={onToggleTTS}
          className={`p-2 rounded-lg border transition-colors ${
            ttsEnabled
              ? 'bg-violet-600/20 text-violet-300 border-violet-500/40'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
          title={ttsEnabled ? 'Speech Output Enabled' : 'Speech Output Muted'}
        >
          {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
