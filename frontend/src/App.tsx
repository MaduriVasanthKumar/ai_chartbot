import { useState, useEffect } from 'react';
import type {
  AuthUser, Profile, Conversation, Message, StudentMemory,
  DocumentItem, QuizAttempt, StudyPlan, AnalyticsOverview, MockInterviewHistoryItem, ActiveTab
} from './types';
import {
  clearAccessToken, fetchCurrentUser, fetchProfile, fetchConversations,
  getAccessToken,
  createConversation, fetchConversationDetails, updateConversationTitle,
  deleteConversation, sendMessage, fetchMemories, fetchDocuments,
  fetchQuizHistory, fetchStudyPlans, fetchAnalytics, fetchMockInterviewHistory,
  login, logout, register
} from './services/api';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatWorkspace } from './components/ChatWorkspace';
import { DocumentWorkspace } from './components/DocumentWorkspace';
import { QuizWorkspace } from './components/QuizWorkspace';
import { MockInterviewWorkspace } from './components/MockInterviewWorkspace';
import { ImageGeneratorWorkspace } from './components/ImageGeneratorWorkspace';
import { StudyPlannerWorkspace } from './components/StudyPlannerWorkspace';
import { AnalyticsWorkspace } from './components/AnalyticsWorkspace';
import { MemoryWorkspace } from './components/MemoryWorkspace';

export function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationDetails, setActiveConversationDetails] = useState<Conversation | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [mode, setMode] = useState<string>('general');
  const [language, setLanguage] = useState<string>('en');
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (
    localStorage.getItem('edumate_theme') === 'light' ? 'light' : 'dark'
  ));

  const [profile, setProfile] = useState<Profile | null>(null);
  const [memories, setMemories] = useState<StudentMemory[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDocument, setActiveDocument] = useState<DocumentItem | null>(null);

  const [quizHistory, setQuizHistory] = useState<QuizAttempt[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [interviewHistory, setInterviewHistory] = useState<MockInterviewHistoryItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isLoadingMessage, setIsLoadingMessage] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const resetWorkspace = () => {
    setConversations([]);
    setActiveConversationId(null);
    setActiveConversationDetails(null);
    setProfile(null);
    setMemories([]);
    setDocuments([]);
    setActiveDocument(null);
    setQuizHistory([]);
    setStudyPlans([]);
    setInterviewHistory([]);
    setAnalytics(null);
    setActiveTab('chat');
    setMode('general');
    setLanguage('en');
    setSidebarOpen(false);
    setChatError(null);
  };

  const handleLogin = async (email: string, password: string): Promise<AuthUser> => {
    const response = await login(email, password);
    return response.user;
  };

  const handleRegister = async (email: string, password: string, displayName: string): Promise<AuthUser> => {
    const response = await register(email, password, displayName);
    return response.user;
  };

  const handleAuthenticated = (user: AuthUser) => {
    resetWorkspace();
    setAuthUser(user);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      resetWorkspace();
      setAuthUser(null);
    }
  };

  // Restore the saved session before requesting any protected learning data.
  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      if (!getAccessToken()) {
        if (mounted) setAuthReady(true);
        return;
      }
      try {
        const user = await fetchCurrentUser();
        if (mounted) setAuthUser(user);
      } catch {
        clearAccessToken();
      } finally {
        if (mounted) setAuthReady(true);
      }
    };

    const handleAuthExpired = () => {
      clearAccessToken();
      setAuthUser(null);
      setAuthReady(true);
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    void restoreSession();
    return () => {
      mounted = false;
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('edumate_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (authUser) void loadInitialData();
  }, [authUser]);

  const loadInitialData = async () => {
    try {
      const [profData, convsData, memsData, docsData, qHist, plansData, interviewHist, analyticsData] = await Promise.all([
        fetchProfile().catch(() => null),
        fetchConversations().catch(() => []),
        fetchMemories().catch(() => []),
        fetchDocuments().catch(() => []),
        fetchQuizHistory().catch(() => []),
        fetchStudyPlans().catch(() => []),
        fetchMockInterviewHistory().catch(() => []),
        fetchAnalytics().catch(() => null)
      ]);

      if (profData) {
        setProfile(profData);
        if (profData.preferred_language) setLanguage(profData.preferred_language);
      }
      setMemories(memsData);
      setDocuments(docsData);
      setQuizHistory(qHist);
      setStudyPlans(plansData);
      setInterviewHistory(interviewHist);
      setAnalytics(analyticsData);

      if (convsData.length > 0) {
        setConversations(convsData);
        selectConversation(convsData[0].id);
      } else {
        handleNewChat();
      }
    } catch (e) {
      console.error("Error loading initial data:", e);
    }
  };

  const selectConversation = async (id: string) => {
    setActiveConversationId(id);
    try {
      const details = await fetchConversationDetails(id);
      setActiveConversationDetails(details);
      if (details.mode) setMode(details.mode);
    } catch (e) {
      console.error("Error fetching conversation details:", e);
    }
  };

  const handleNewChat = async () => {
    try {
      const newConv = await createConversation("New Study Session", mode);
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setActiveConversationDetails({ ...newConv, messages: [] });
      setActiveTab('chat');
    } catch (e) {
      console.error("Error creating conversation:", e);
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const updated = await updateConversationTitle(id, newTitle);
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: updated.title } : c));
      if (activeConversationDetails?.id === id) {
        setActiveConversationDetails(prev => prev ? { ...prev, title: updated.title } : null);
      }
    } catch (e) {
      console.error("Error renaming conversation:", e);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter(c => c.id !== id);
        if (remaining.length > 0) {
          selectConversation(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (e) {
      console.error("Error deleting conversation:", e);
    }
  };

  const handleSendMessage = async (content: string, options?: { documentId?: string; webSearch?: boolean }) => {
    if (!activeConversationId || !authUser) return;

    try {
      setChatError(null);
      setIsLoadingMessage(true);

      // Optimistic UI insert of user message
      const tempUserMsg: Message = {
        id: `temp_${Date.now()}`,
        conversation_id: activeConversationId,
        user_id: authUser.id,
        role: 'user',
        content,
        created_at: new Date().toISOString()
      };

      setActiveConversationDetails(prev => prev ? {
        ...prev,
        messages: [...(prev.messages || []), tempUserMsg]
      } : null);

      const res = await sendMessage(
        activeConversationId,
        content,
        mode,
        language,
        options?.documentId,
        options?.webSearch
      );

      // Replace with real backend user & assistant messages
      setActiveConversationDetails(prev => prev ? {
        ...prev,
        messages: [...(prev.messages || []).filter(m => m.id !== tempUserMsg.id), res.user_message, res.assistant_message]
      } : null);

      // Refresh secondary workspace data independently. A refresh failure must not
      // make a successfully saved chat message look like an AI failure.
      const updatedConvs = await fetchConversations();
      setConversations(updatedConvs);
      const [updatedMems, analyticsData] = await Promise.all([
        fetchMemories().catch((error) => {
          console.error("Error refreshing memories:", error);
          return memories;
        }),
        fetchAnalytics().catch((error) => {
          console.error("Error refreshing analytics:", error);
          return analytics;
        }),
      ]);
      setMemories(updatedMems);
      setAnalytics(analyticsData);

    } catch (e) {
      console.error("Error sending message:", e);
      setChatError(e instanceof Error ? e.message : "The chat request failed. Please try again.");
    } finally {
      setIsLoadingMessage(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Restoring your secure session…
      </div>
    );
  }

  if (!authUser) {
    return (
      <AuthScreen
        onAuthenticated={handleAuthenticated}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    );
  }

  return (
    <div className={`flex h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans ${theme === 'light' ? 'light-mode' : ''}`}>
      {/* Left Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        activeTab={activeTab}
        profile={profile}
        isOpen={sidebarOpen}
        onSelectConversation={selectConversation}
        onNewChat={handleNewChat}
        onSelectTab={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-72 transition-all">
        {/* Top Header */}
        <Header
          mode={mode}
          language={language}
          ttsEnabled={ttsEnabled}
          activeTab={activeTab}
          memoryCount={memories.length}
          theme={theme}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onModeChange={(m) => setMode(m)}
          onLanguageChange={(l) => setLanguage(l)}
          onToggleTTS={() => setTtsEnabled(!ttsEnabled)}
          onOpenMemoryTab={() => setActiveTab('memory')}
          onThemeChange={setTheme}
        />

        {/* Tab Workspaces */}
        <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {activeTab === 'chat' && (
            <ChatWorkspace
              messages={activeConversationDetails?.messages || []}
              isLoading={isLoadingMessage}
              mode={mode}
              activeDocument={activeDocument}
              chatError={chatError}
              onSendMessage={handleSendMessage}
              onClearActiveDocument={() => setActiveDocument(null)}
              onOpenDocumentModal={() => setActiveTab('documents')}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentWorkspace
              documents={documents}
              onDocumentUploaded={(newDoc) => setDocuments(prev => [newDoc, ...prev])}
              onAskDocument={(doc) => {
                setActiveDocument(doc);
                setActiveTab('chat');
                setMode('document');
              }}
            />
          )}

          {activeTab === 'quizzes' && (
            <QuizWorkspace
              history={quizHistory}
              onQuizCompleted={async () => {
                const qHist = await fetchQuizHistory();
                setQuizHistory(qHist);
                const analyticsData = await fetchAnalytics();
                setAnalytics(analyticsData);
              }}
            />
          )}

          {activeTab === 'interviews' && authUser && (
            <MockInterviewWorkspace
              history={interviewHistory}
              accountEmail={authUser.email}
              onInterviewCompleted={async () => {
                const updatedHistory = await fetchMockInterviewHistory();
                setInterviewHistory(updatedHistory);
              }}
            />
          )}

          {activeTab === 'image_generator' && (
            <ImageGeneratorWorkspace />
          )}

          {activeTab === 'study_planner' && (
            <StudyPlannerWorkspace
              plans={studyPlans}
              onPlanCreated={async () => {
                const plansData = await fetchStudyPlans();
                setStudyPlans(plansData);
                const analyticsData = await fetchAnalytics();
                setAnalytics(analyticsData);
              }}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsWorkspace
              data={analytics}
              onNavigateToTab={(t) => setActiveTab(t)}
            />
          )}

          {activeTab === 'memory' && (
            <MemoryWorkspace
              profile={profile}
              memories={memories}
              onProfileUpdated={async () => {
                const p = await fetchProfile();
                setProfile(p);
              }}
              onMemoriesUpdated={async () => {
                const m = await fetchMemories();
                setMemories(m);
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
