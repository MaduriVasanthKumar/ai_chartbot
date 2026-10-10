import React, { useState } from 'react';
import { 
  MessageSquare, Plus, Search, Trash2, Edit3, Check, X, 
  FileText, HelpCircle, Calendar, BarChart2, Brain, Sparkles, User, LogOut, Mic2, ImageIcon
} from 'lucide-react';
import type { Conversation, ActiveTab, Profile } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeTab: ActiveTab;
  profile: Profile | null;
  isOpen: boolean;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onSelectTab: (tab: ActiveTab) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  activeTab,
  profile,
  isOpen,
  onSelectConversation,
  onNewChat,
  onSelectTab,
  onRenameConversation,
  onDeleteConversation,
  onLogout,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartRename = (c: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditTitle(c.title);
  };

  const handleSaveRename = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleConfirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteConversation(id);
    setDeletingId(null);
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 md:translate-x-0 ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-lg leading-tight flex items-center gap-1.5">
              EduMate <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">AI</span>
            </h1>
            <p className="text-xs text-slate-400">Advanced Learning Assistant</p>
          </div>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>New Study Session</span>
        </button>
      </div>

      {/* Main Tab Navigation */}
      <div className="px-3 py-2 border-b border-slate-800/80 space-y-1">
        <button
          onClick={() => onSelectTab('chat')}
          className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
            activeTab === 'chat' ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>AI Chat Workspace</span>
        </button>

        <button
          onClick={() => onSelectTab('documents')}
          className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
            activeTab === 'documents' ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Document Library & Q&A</span>
        </button>

        <button
          onClick={() => onSelectTab('quizzes')}
          className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
            activeTab === 'quizzes' ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Quiz & Practice Engine</span>
        </button>

        <button
          onClick={() => onSelectTab('interviews')}
          className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
            activeTab === 'interviews' ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Mic2 className="w-4 h-4" />
          <span>AI Mock Interview</span>
        </button>

        <button
          onClick={() => onSelectTab('image_generator')}
          className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
            activeTab === 'image_generator' ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>AI Image Generator</span>
        </button>

        <button
          onClick={() => onSelectTab('study_planner')}
          className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
            activeTab === 'study_planner' ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Study Planner</span>
        </button>

        <button
          onClick={() => onSelectTab('analytics')}
          className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
            activeTab === 'analytics' ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Learning Analytics</span>
        </button>

        <button
          onClick={() => onSelectTab('memory')}
          className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
            activeTab === 'memory' ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Brain className="w-4 h-4" />
          <span>Profile & Persistent Memory</span>
        </button>
      </div>

      {/* Conversation Search & History Section */}
      <div className="px-3 pt-3 pb-2 flex-1 flex flex-col min-h-0">
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950/60 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
          />
        </div>

        <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-2 mb-1">
          Recent Conversations
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {filteredConversations.length === 0 ? (
            <div className="text-xs text-slate-500 p-4 text-center">
              No conversations found.
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = activeTab === 'chat' && activeConversationId === c.id;
              const isEditing = editingId === c.id;
              const isDeleting = deletingId === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectConversation(c.id);
                    onSelectTab('chat');
                  }}
                  className={`group relative p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-800 text-violet-300 font-medium border border-slate-700/80'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-violet-400' : 'text-slate-500'}`} />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="bg-slate-950 border border-violet-500 text-slate-100 text-xs rounded px-1.5 py-0.5 w-full focus:outline-none"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="truncate">{c.title}</span>
                    )}
                  </div>

                  {/* Inline Action buttons */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isEditing ? (
                      <>
                        <button onClick={(e) => handleSaveRename(c.id, e)} className="p-1 hover:text-emerald-400">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={handleCancelRename} className="p-1 hover:text-rose-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : isDeleting ? (
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-rose-500/50">
                        <span className="text-[10px] text-rose-400 font-semibold px-1">Delete?</span>
                        <button onClick={(e) => handleConfirmDelete(c.id, e)} className="p-0.5 text-rose-400 hover:text-rose-300">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeletingId(null); }} className="p-0.5 text-slate-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button onClick={(e) => handleStartRename(c, e)} className="p-1 text-slate-400 hover:text-slate-200">
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeletingId(c.id); }} className="p-1 text-slate-400 hover:text-rose-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
          <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300 font-bold text-xs shrink-0">
            {profile?.display_name ? profile.display_name[0].toUpperCase() : <User className="w-4 h-4" />}
          </div>
          <div className="truncate">
            <div className="text-xs font-semibold text-slate-200 truncate">
              {profile?.display_name || 'Alex Learner'}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {profile?.academic_level || 'Undergraduate'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="p-2 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors shrink-0"
          title="Log out"
          aria-label="Log out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
