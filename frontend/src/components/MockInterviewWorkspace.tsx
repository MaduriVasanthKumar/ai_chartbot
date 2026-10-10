import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Award,
  BarChart3,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  Clock3,
  Mail,
  Mic2,
  MicOff,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Target,
  TimerReset,
  Volume2,
} from 'lucide-react';
import type {
  MockInterview,
  MockInterviewHistoryItem,
  MockInterviewResult,
} from '../types';
import {
  createMockInterview,
  emailMockInterviewReport,
  evaluateMockInterview,
} from '../services/api';

interface MockInterviewWorkspaceProps {
  history: MockInterviewHistoryItem[];
  accountEmail: string;
  onInterviewCompleted: () => Promise<void>;
}

const inputClass = 'w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500';
const labelClass = 'text-xs font-medium text-slate-300';

type CaptureMode = 'text' | 'audio' | 'video';

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function MockInterviewWorkspace({
  history,
  accountEmail,
  onInterviewCompleted,
}: MockInterviewWorkspaceProps) {
  const [subject, setSubject] = useState('Computer Science');
  const [course, setCourse] = useState('Data Structures and Algorithms');
  const [targetRole, setTargetRole] = useState('Software Engineer Intern');
  const [experienceLevel, setExperienceLevel] = useState('student');
  const [interviewType, setInterviewType] = useState('mixed');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(180);

  const [activeInterview, setActiveInterview] = useState<MockInterview | null>(null);
  const [result, setResult] = useState<MockInterviewResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(180);
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const currentQuestion = activeInterview?.questions[currentQuestionIndex];
  const isTakingInterview = Boolean(activeInterview && !result);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('video');
  const [mediaReady, setMediaReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mediaError, setMediaError] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptBaseRef = useRef('');
  const mediaRequestIdRef = useRef(0);

  const attachVideoStream = () => {
    if (captureMode !== 'video' || !videoRef.current || !mediaStreamRef.current) return;
    if (videoRef.current.srcObject !== mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
    }
    void videoRef.current.play().catch(() => {
      // The muted, inline video normally autoplays; the preview remains usable if a browser delays playback.
    });
  };

  const stopMedia = () => {
    // In React development mode an earlier getUserMedia request can resolve after
    // its effect has already been cleaned up. Invalidate that request first.
    mediaRequestIdRef.current += 1;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setMediaReady(false);
    setIsRecording(false);
    setIsListening(false);
  };

  const prepareMedia = async () => {
    if (mediaStreamRef.current) {
      const hasLiveTrack = mediaStreamRef.current.getTracks().some((track) => track.readyState === 'live');
      if (hasLiveTrack) {
        attachVideoStream();
        setMediaReady(true);
        return;
      }
      mediaStreamRef.current = null;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('Camera and microphone APIs are unavailable. Use http://localhost:5173 in Chrome or Edge, or continue with typed answers.');
      return;
    }

    const requestId = ++mediaRequestIdRef.current;
    try {
      setMediaError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: captureMode === 'video',
        audio: true,
      });

      // Ignore a late response from a request that was cancelled by a mode change,
      // component cleanup, or a newer permission request.
      if (requestId !== mediaRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      mediaStreamRef.current = stream;
      setMediaReady(true);
      attachVideoStream();
    } catch (error) {
      if (requestId !== mediaRequestIdRef.current) return;
      const errorName = error instanceof DOMException ? error.name : error instanceof Error ? error.name : 'UnknownError';
      const message = error instanceof Error ? error.message : '';
      const explanation = errorName === 'NotAllowedError'
        ? 'Allow camera and microphone access for http://localhost:5173 in Chrome.'
        : errorName === 'NotFoundError'
          ? 'No camera or microphone was found. Check that a device is connected and selected.'
          : errorName === 'NotReadableError'
            ? 'The camera or microphone is busy in another application. Close Teams, Zoom, or similar apps.'
            : errorName === 'SecurityError'
              ? 'Open the app at http://localhost:5173; browser security blocked this device request.'
              : `The browser returned ${errorName}${message ? `: ${message}` : ''}.`;
      setMediaError(`${explanation} You can continue with typed answers.`);
      setMediaReady(false);
    }
  };

  const speakQuestion = () => {
    if (!currentQuestion || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion.question);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const startSpeechRecognition = () => {
    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition || !currentQuestion) {
      setMediaError('Speech-to-text is not supported in this browser. You can still record audio/video or type your answer.');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    transcriptBaseRef.current = answers[String(currentQuestion.id)] || '';
    recognition.onresult = (event) => {
      let finalText = transcriptBaseRef.current;
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText = `${finalText} ${transcript}`.trim();
        else interimText += ` ${transcript}`;
      }
      const combined = `${finalText} ${interimText}`.trim();
      setAnswers((previous) => ({ ...previous, [String(currentQuestion.id)]: combined }));
      transcriptBaseRef.current = finalText;
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      const speechError = event.error || 'unknown error';
      const explanation = speechError === 'not-allowed' || speechError === 'service-not-allowed'
        ? 'Chrome blocked speech recognition. Allow microphone access for http://localhost:5173.'
        : speechError === 'audio-capture'
          ? 'No usable microphone was found. Check the selected Windows input device.'
          : speechError === 'no-speech'
            ? 'No speech was detected. Speak clearly and start transcription again.'
            : speechError === 'network'
              ? 'Chrome speech recognition needs a working network connection.'
              : `Speech recognition stopped (${speechError}).`;
      setMediaError(`${explanation} You can continue typing.`);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setMediaError('');
      setIsListening(true);
    } catch (error) {
      recognitionRef.current = null;
      setIsListening(false);
      setMediaError(`Speech recognition could not start${error instanceof Error ? `: ${error.message}` : '.'} You can continue typing.`);
    }
  };

  const stopSpeechRecognition = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const startRecording = async () => {
    if (!currentQuestion) return;
    if (!mediaStreamRef.current) await prepareMedia();
    const stream = mediaStreamRef.current;
    if (!stream || !('MediaRecorder' in window)) {
      setMediaError('Recording is not supported in this browser. You can continue with speech-to-text or typed answers.');
      return;
    }
    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordedChunksRef.current.push(event.data);
    };
    recorder.onstop = () => setIsRecording(false);
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    startSpeechRecognition();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopSpeechRecognition();
    setIsRecording(false);
  };

  useEffect(() => {
    if (!isTakingInterview || captureMode === 'text') {
      if (!isTakingInterview) stopMedia();
      window.speechSynthesis?.cancel();
      return undefined;
    }
    void prepareMedia();
    return () => {
      stopMedia();
      window.speechSynthesis?.cancel();
    };
  }, [isTakingInterview, captureMode]);

  useEffect(() => {
    attachVideoStream();
  }, [mediaReady, captureMode]);

  useEffect(() => {
    if (!isTakingInterview || !currentQuestion || captureMode === 'text') return undefined;
    const timeout = window.setTimeout(speakQuestion, 250);
    return () => window.clearTimeout(timeout);
  }, [currentQuestion?.id, isTakingInterview, captureMode]);

  useEffect(() => {
    if (!isTakingInterview) return undefined;
    const timer = window.setInterval(() => {
      setRemainingSeconds((previous) => Math.max(0, previous - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isTakingInterview]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainder = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
  };

  const elapsedForCurrentQuestion = () => {
    if (!questionStartedAt || !currentQuestion) return 0;
    return Math.max(0, Math.round((Date.now() - questionStartedAt) / 1000));
  };

  const recordCurrentDuration = () => {
    if (!currentQuestion) return durations;
    const questionId = String(currentQuestion.id);
    return {
      ...durations,
      [questionId]: (durations[questionId] || 0) + elapsedForCurrentQuestion(),
    };
  };

  const handleCreateInterview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setIsCreating(true);
    try {
      const interview = await createMockInterview({
        subject,
        course,
        target_role: targetRole,
        experience_level: experienceLevel,
        interview_type: interviewType,
        difficulty,
        question_count: questionCount,
        time_limit_seconds: timeLimitSeconds,
      });
      setActiveInterview(interview);
      setResult(null);
      setAnswers({});
      setDurations({});
      setCurrentQuestionIndex(0);
      setRemainingSeconds(interview.time_limit_seconds);
      setQuestionStartedAt(Date.now());
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Could not create the interview.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleNextQuestion = () => {
    if (!activeInterview || !currentQuestion) return;
    setDurations(recordCurrentDuration());
    setCurrentQuestionIndex((previous) => previous + 1);
    setQuestionStartedAt(Date.now());
  };

  const handleSubmitInterview = async () => {
    if (!activeInterview || isEvaluating) return;
    const finalDurations = recordCurrentDuration();
    setDurations(finalDurations);
    setIsEvaluating(true);
    setNotice(null);
    try {
      const evaluated = await evaluateMockInterview(activeInterview.id, answers, finalDurations);
      setResult(evaluated);
      await onInterviewCompleted();
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Could not evaluate the interview.' });
    } finally {
      setIsEvaluating(false);
    }
  };

  useEffect(() => {
    if (isTakingInterview && remainingSeconds === 0 && !isEvaluating) {
      void handleSubmitInterview();
    }
  }, [remainingSeconds, isTakingInterview, isEvaluating]);

  const handleEmailReport = async () => {
    if (!result || isEmailing) return;
    setIsEmailing(true);
    setNotice(null);
    try {
      const response = await emailMockInterviewReport(result.id);
      setNotice({ type: response.sent ? 'success' : 'info', text: `${response.message} Recipient: ${response.email}` });
      if (response.sent) setResult((previous) => previous ? { ...previous, email_status: 'sent', emailed_to: response.email } : previous);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Could not send the report.' });
    } finally {
      setIsEmailing(false);
    }
  };

  const startOver = () => {
    setActiveInterview(null);
    setResult(null);
    setAnswers({});
    setDurations({});
    setCurrentQuestionIndex(0);
    setQuestionStartedAt(null);
    setNotice(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-900 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Mic2 className="w-6 h-6 text-violet-400" />
          AI Mock Interview
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Practice realistic technical, behavioral, and scenario questions for any course, subject, or target role. EduMate scores your answers and gives you a targeted improvement report.
        </p>
      </div>

      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-xs ${notice.type === 'error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : notice.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
          {notice.text}
        </div>
      )}

      {isTakingInterview && activeInterview && currentQuestion && (
        <section className="max-w-3xl mx-auto rounded-2xl bg-slate-950 border border-slate-800 p-6 shadow-xl space-y-5">
          <div className="flex flex-wrap gap-3 items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2 text-violet-300 text-xs font-semibold">
                <BriefcaseBusiness className="w-4 h-4" /> {activeInterview.target_role || `${activeInterview.subject} interview`}
              </div>
              <h3 className="text-base font-bold text-slate-100 mt-1">{activeInterview.course || activeInterview.subject}</h3>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${remainingSeconds <= 30 ? 'border-rose-500/50 bg-rose-500/10 text-rose-300' : 'border-violet-500/30 bg-violet-500/10 text-violet-300'}`}>
              <Clock3 className="w-3.5 h-3.5" /> {formatTime(remainingSeconds)} remaining
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Question {currentQuestionIndex + 1} of {activeInterview.questions.length}</span>
            <span className="capitalize">{currentQuestion.category} · {activeInterview.difficulty}</span>
          </div>

          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all" style={{ width: `${((currentQuestionIndex + 1) / activeInterview.questions.length) * 100}%` }} />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-200">Interview answer mode</div>
                <div className="text-[11px] text-slate-500 mt-1">Video/audio stays in this browser session; the spoken transcript is used for AI scoring.</div>
              </div>
              <select
                value={captureMode}
                onChange={(event) => setCaptureMode(event.target.value as CaptureMode)}
                className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
              >
                <option value="video">Video + microphone</option>
                <option value="audio">Audio + microphone</option>
                <option value="text">Typed answers</option>
              </select>
            </div>

            {captureMode === 'video' && (
              <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-black aspect-video max-w-xl mx-auto">
                <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                {!mediaReady && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-slate-500"><Camera className="w-8 h-8 text-slate-600" /><span>Camera preview will appear after permission is granted.</span></div>}
                {isRecording && <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-rose-600/90 px-3 py-1.5 text-[11px] font-bold text-white"><span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Recording</div>}
              </div>
            )}

            {captureMode === 'audio' && (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex items-center gap-3 text-xs text-slate-300">
                {isRecording ? <Mic2 className="w-6 h-6 text-rose-400 animate-pulse" /> : <MicOff className="w-6 h-6 text-slate-500" />}
                <div><div className="font-semibold">{isRecording ? 'Audio recording in progress' : 'Audio interview mode'}</div><div className="text-[11px] text-slate-500 mt-1">Your answer is transcribed into the answer box below.</div></div>
              </div>
            )}

            {captureMode !== 'text' && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void prepareMedia()} className="rounded-lg border border-slate-700 hover:border-violet-500 px-3 py-2 text-[11px] font-semibold text-slate-300 flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5" /> {mediaReady ? 'Camera & mic ready' : 'Allow camera & mic'}
                </button>
                <button type="button" onClick={speakQuestion} className="rounded-lg border border-slate-700 hover:border-violet-500 px-3 py-2 text-[11px] font-semibold text-slate-300 flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5" /> {isSpeaking ? 'Reading question…' : 'Read question aloud'}
                </button>
                <button type="button" onClick={() => { if (isRecording) stopRecording(); else void startRecording(); }} disabled={!mediaReady} className="rounded-lg bg-rose-600/90 hover:bg-rose-500 disabled:opacity-40 px-3 py-2 text-[11px] font-semibold text-white flex items-center gap-2">
                  {isRecording ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} {isRecording ? 'Stop recording' : 'Record answer'}
                </button>
                <button type="button" onClick={() => { if (isListening) stopSpeechRecognition(); else startSpeechRecognition(); }} disabled={!mediaReady} className="rounded-lg border border-slate-700 hover:border-violet-500 disabled:opacity-40 px-3 py-2 text-[11px] font-semibold text-slate-300 flex items-center gap-2">
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic2 className="w-3.5 h-3.5" />} {isListening ? 'Stop transcription' : 'Start transcription'}
                </button>
              </div>
            )}

            {mediaError && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">{mediaError}</div>}
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold leading-relaxed text-slate-100">{currentQuestion.question}</h4>
            <textarea
              value={answers[String(currentQuestion.id)] || ''}
              onChange={(event) => setAnswers((previous) => ({ ...previous, [String(currentQuestion.id)]: event.target.value }))}
              placeholder={captureMode === 'text' ? 'Think aloud in a structured way. Include assumptions, examples, actions, and outcomes where relevant.' : 'Your spoken transcript will appear here. You can edit it or type an answer manually.'}
              className="w-full min-h-48 rounded-xl bg-slate-900 border border-slate-800 p-4 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-y"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <span className="text-[11px] text-slate-500">Your answer is evaluated after you finish the interview.</span>
            {currentQuestionIndex === activeInterview.questions.length - 1 ? (
              <button onClick={() => void handleSubmitInterview()} disabled={isEvaluating} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 px-5 py-2.5 text-xs font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4" /> {isEvaluating ? 'Evaluating…' : 'Finish & score interview'}
              </button>
            ) : (
              <button onClick={handleNextQuestion} className="rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-xs font-bold text-white">Next question</button>
            )}
          </div>
        </section>
      )}

      {result && (
        <section className="max-w-4xl mx-auto space-y-5">
          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-violet-300 text-xs font-semibold"><Award className="w-4 h-4" /> Interview report</div>
                <h3 className="text-xl font-bold text-slate-100 mt-1">{result.subject}{result.course ? ` · ${result.course}` : ''}</h3>
                <p className="text-xs text-slate-400 mt-1">{result.target_role || 'General practice'} · <span className="capitalize">{result.interview_type}</span> · <span className="capitalize">{result.difficulty}</span></p>
              </div>
              <div className="text-center rounded-2xl bg-violet-600/10 border border-violet-500/30 px-6 py-3">
                <div className="text-3xl font-extrabold text-violet-300">{result.percentage}%</div>
                <div className="text-[11px] text-slate-400">{result.overall_score}/{result.max_score} points</div>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-slate-900/70 border border-slate-800 px-4 py-3 text-sm text-slate-200">
              <span className="font-semibold text-emerald-300">Recommendation:</span> {result.recommendation}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2">Strengths</h4>
                <ul className="space-y-2 text-xs text-slate-300">{result.strengths.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />{item}</li>)}</ul>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">Improvement areas</h4>
                <ul className="space-y-2 text-xs text-slate-300">{result.improvements.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />{item}</li>)}</ul>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-violet-400" /> Question-by-question feedback</h4>
            {result.question_results.map((item) => (
              <div key={item.question_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3"><div className="text-xs font-semibold text-slate-200">{item.question_id}. {item.question}</div><span className={`shrink-0 text-xs font-bold ${item.score >= 7 ? 'text-emerald-400' : item.score >= 5 ? 'text-amber-400' : 'text-rose-400'}`}>{item.score}/10</span></div>
                <p className="text-xs text-slate-400"><span className="text-slate-300 font-medium">Your answer:</span> {item.answer}</p>
                <p className="text-xs text-slate-300">{item.feedback}</p>
                <div className="text-[11px] text-slate-500">Answer time: {item.duration_seconds}s</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => void handleEmailReport()} disabled={isEmailing} className="rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2.5 text-xs font-bold text-white flex items-center gap-2"><Mail className="w-4 h-4" />{isEmailing ? 'Sending…' : 'Send report to my login email'}</button>
            <span className="text-[11px] text-slate-500">Recipient is locked to {accountEmail}</span>
            <button onClick={startOver} className="rounded-xl border border-slate-700 hover:border-slate-500 px-4 py-2.5 text-xs font-semibold text-slate-300 flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Start another interview</button>
          </div>
        </section>
      )}

      {!activeInterview && !result && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <form onSubmit={handleCreateInterview} className="xl:col-span-2 rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-5 shadow-xl">
            <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-violet-400" /><h3 className="text-sm font-bold text-slate-100">Configure your interview</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1.5"><span className={labelClass}>Subject *</span><input required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Computer Science, Finance" className={inputClass} /></label>
              <label className="space-y-1.5"><span className={labelClass}>Course or specialization</span><input value={course} onChange={(event) => setCourse(event.target.value)} placeholder="e.g. Operating Systems" className={inputClass} /></label>
              <label className="space-y-1.5"><span className={labelClass}>Target role</span><input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} placeholder="e.g. Data Analyst" className={inputClass} /></label>
              <label className="space-y-1.5"><span className={labelClass}>Experience level</span><select value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)} className={inputClass}><option value="student">Student</option><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior</option></select></label>
              <label className="space-y-1.5"><span className={labelClass}>Interview type</span><select value={interviewType} onChange={(event) => setInterviewType(event.target.value)} className={inputClass}><option value="mixed">Mixed: technical + behavioral</option><option value="technical">Technical</option><option value="behavioral">Behavioral</option><option value="case">Case / scenario</option></select></label>
              <label className="space-y-1.5"><span className={labelClass}>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className={inputClass}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
              <label className="space-y-1.5"><span className={labelClass}>Questions</span><input type="number" min={3} max={10} value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} className={inputClass} /></label>
              <label className="space-y-1.5"><span className={labelClass}>Time limit</span><select value={timeLimitSeconds} onChange={(event) => setTimeLimitSeconds(Number(event.target.value))} className={inputClass}><option value={120}>2 minutes</option><option value={180}>3 minutes</option><option value={300}>5 minutes</option><option value={600}>10 minutes</option></select></label>
            </div>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-slate-300 flex gap-2"><TimerReset className="w-4 h-4 text-violet-300 shrink-0" /> The timer covers the full interview. You can type structured answers and move at your own pace.</div>
            <button type="submit" disabled={isCreating} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 py-3 text-xs font-bold text-white flex items-center justify-center gap-2">{isCreating ? 'Preparing interview…' : 'Start AI mock interview'} <Mic2 className="w-4 h-4" /></button>
          </form>

          <section className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2"><Clock3 className="w-4 h-4 text-violet-400" /> Interview history</h3>
            {history.length === 0 ? <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-xs text-slate-500">No mock interviews yet. Start one to build your readiness history.</div> : <div className="space-y-2 max-h-[28rem] overflow-y-auto">{history.map((item) => <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"><div className="flex justify-between gap-2"><div className="text-xs font-semibold text-slate-200 truncate">{item.subject}</div><div className={`text-xs font-bold ${item.percentage !== null && item.percentage !== undefined && item.percentage >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>{item.percentage !== null && item.percentage !== undefined ? `${item.percentage}%` : 'In progress'}</div></div><div className="text-[10px] text-slate-400 mt-1 truncate">{item.course || 'General'} · {item.target_role || 'Practice'} · {new Date(item.created_at).toLocaleDateString()}</div><div className="text-[10px] text-slate-500 mt-1 capitalize">{item.interview_type} · {item.difficulty}</div></div>)}</div>}
          </section>
        </div>
      )}
    </div>
  );
}
