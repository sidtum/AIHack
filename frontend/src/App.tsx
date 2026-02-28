import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, ArrowUp, Minus, X, SlidersHorizontal, ChevronRight, Volume2, VolumeX, Maximize2, PanelLeftClose, PanelLeftOpen, Square, BookOpen } from 'lucide-react';
import { ProfileDrawer } from './components/ProfileDrawer';
import { QuizView } from './components/QuizView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { StudyPanel } from './components/StudyPanel';
import { StudyResults, StudyResultsData } from './components/StudyResults';
import { AgentBrowser } from './components/AgentBrowser';
import { CareerDashboard } from './components/CareerDashboard';
import { NotesDashboard } from './components/NotesDashboard';
import { SmsBadge } from './components/SmsBadge';
import { StudyModePage } from './components/StudyModePage';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useTTS } from './hooks/useTTS';

// ─── Types ──────────────────────────────────────────────────────────────────
type AppMode = 'chat' | 'study' | 'quiz' | 'results' | 'study_mode';

interface Message {
  role: 'user' | 'agent';
  text: string;
  thoughts?: string[];
  source?: 'sms';
}

interface StudyData {
  session_id: number;
  course_name: string;
  concepts: any[];
  questions: any[];
  content_raw: string;
}

// ─── Star particles ────────────────────────────────────────────────────────
function Star({ x, y, size, delay }: { x: string; y: string; size: number; delay: number }) {
  return (
    <motion.div
      animate={{ opacity: [0, 0.9, 0], scale: [0.6, 1.4, 0.6] }}
      transition={{ duration: 3.5 + Math.random() * 3, repeat: Infinity, delay }}
      style={{
        position: 'absolute', left: x, top: y,
        width: size, height: size, borderRadius: '50%',
        background: 'radial-gradient(circle, #ffe8a0, #f0b830)',
        boxShadow: `0 0 ${size * 3}px ${size * 1.5}px rgba(240,180,40,0.35)`,
        pointerEvents: 'none',
      }}
    />
  );
}

const STARS = Array.from({ length: 32 }, (_, i) => ({
  id: i,
  x: `${5 + Math.random() * 90}%`,
  y: `${5 + Math.random() * 90}%`,
  size: 0.8 + Math.random() * 1.6,
  delay: Math.random() * 6,
}));

// ─── Window control button ─────────────────────────────────────────────────
function WinBtn({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: h ? (danger ? 'rgba(255,90,90,0.18)' : 'rgba(255,240,200,0.08)') : 'transparent',
        border: 'none', cursor: 'pointer',
        color: h ? (danger ? '#ff8080' : '#ffe8b0') : 'rgba(255,240,170,0.3)',
        width: 28, height: 28, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s', flexShrink: 0,
        ...({ WebkitAppRegion: 'no-drag' } as any),
      }}
    >
      {children}
    </button>
  );
}

// ─── Typing dots ───────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: '#cce0d8' }}
        />
      ))}
    </div>
  );
}

// ─── Thought Box Component ─────────────────────────────────────────────────
function ThoughtBox({ thoughts, complete }: { thoughts: string[]; complete: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      marginBottom: complete ? 8 : 4, padding: '6px 10px',
      background: 'rgba(255,255,255,0.03)', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}
      >
        {!complete ? (
          <motion.div
            animate={{ scale: [0.7, 1.3, 0.7], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#f0c050', flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6ee7a0', flexShrink: 0 }} />
        )}
        <span style={{
          fontFamily: "'DM Sans', sans-serif", fontStyle: 'italic',
          fontSize: 11, color: 'rgba(200,230,210,0.5)', flex: 1,
        }}>
          {complete ? `${thoughts.length} execution step${thoughts.length !== 1 ? 's' : ''}` : 'Thinking...'}
        </span>
        <motion.div animate={{ rotate: open ? 90 : 0 }} style={{ color: 'rgba(200,230,210,0.35)', flexShrink: 0 }}>
          <ChevronRight size={11} />
        </motion.div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3,
              maxHeight: 180, overflowY: 'auto', overflowX: 'hidden',
            }}>
              {thoughts.map((t, i) => (
                <div key={i} style={{ fontSize: 11, color: 'rgba(200,230,210,0.38)', paddingLeft: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>
                  — {t}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Markdown renderer ─────────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith('**') && seg.endsWith('**'))
      return <strong key={i} style={{ fontWeight: 600, color: 'inherit' }}>{seg.slice(2, -2)}</strong>;
    if (seg.startsWith('*') && seg.endsWith('*'))
      return <em key={i} style={{ fontStyle: 'italic' }}>{seg.slice(1, -1)}</em>;
    return seg;
  });
}

// ─── Main App ──────────────────────────────────────────────────────────────
function App() {
  const [status, setStatus] = useState<'idle' | 'connected' | 'executing' | 'offline'>('idle');
  const [statusText, setStatusText] = useState('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCareerDashboardOpen, setIsCareerDashboardOpen] = useState(false);
  const [isNotesDashboardOpen, setIsNotesDashboardOpen] = useState(false);
  const [highlightFields, setHighlightFields] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [focused, setFocused] = useState(false);
  const [inputHeight, setInputHeight] = useState('21px');
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAITyping, setIsAITyping] = useState(false);

  const [mode, setMode] = useState<AppMode>('chat');
  const [studyData, setStudyData] = useState<StudyData | null>(null);
  const [quizData, setQuizData] = useState<any>(null);
  const [studyResults, setStudyResults] = useState<StudyResultsData | null>(null);
  const [qaMessages, setQaMessages] = useState<{ role: 'user' | 'agent'; text: string }[]>([]);

  // ── Study mode state ──
  const [ankiCards, setAnkiCards] = useState<{ front: string; back: string }[]>([]);
  const [osuResources, setOsuResources] = useState<{ title: string; url: string; tag: string }[]>([]);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [studySubject, setStudySubject] = useState('');
  const [studyPlan, setStudyPlan] = useState<{ step: number; text: string }[]>([]);

  // ── Course picker state ──
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [courseInput, setCourseInput] = useState('');
  const [pendingPlanText, setPendingPlanText] = useState('');

  const ws = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const browserNavigateRef = useRef<((url: string) => void) | null>(null);
  const browserForceUpdateRef = useRef<(() => void) | null>(null);
  const userSentAtRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice hooks
  const { isListening, transcript, interimTranscript, toggleListening } = useSpeechRecognition();
  const { isTTSEnabled, toggleTTS, speak } = useTTS();

  const speakRef = useRef(speak);
  useEffect(() => { speakRef.current = speak; }, [speak]);

  // ── STT: fill input with recognized speech ──
  useEffect(() => {
    if (transcript) setInputText(transcript);
  }, [transcript]);

  useEffect(() => {
    if (interimTranscript) setInputText(interimTranscript);
  }, [interimTranscript]);

  // ── Onboarding check ──
  useEffect(() => {
    fetch('http://127.0.0.1:8000/profile/status')
      .then(r => r.json())
      .then(data => setShowOnboarding(!data.complete))
      .catch(() => setShowOnboarding(false));
  }, []);

  // ── Hide/restore native browser when study overlay or career dashboard opens/closes ──
  // useLayoutEffect fires before paint, preventing a single-frame flash of Google showing through overlays
  useLayoutEffect(() => {
    const ipc = (window as any).require?.('electron')?.ipcRenderer;
    if (mode !== 'chat' || isCareerDashboardOpen || isNotesDashboardOpen) {
      ipc?.send('hide-browser');
    } else {
      browserForceUpdateRef.current?.();
    }
  }, [mode, isCareerDashboardOpen, isNotesDashboardOpen]);

  // ── WebSocket connection with auto-reconnect ──
  const connectWSRef = useRef<() => void>(() => { });

  useEffect(() => {
    const connectWS = () => {
      if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const socket = new WebSocket('ws://127.0.0.1:8000/ws');
      ws.current = socket;

      socket.onopen = () => {
        setStatus('connected');
        setStatusText('connected');
      };

      socket.onclose = () => {
        setStatus('offline');
        setStatusText('offline');
        reconnectTimer.current = setTimeout(() => connectWSRef.current(), 3000);
      };

      socket.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);

          if (d.type === 'agent_response') {
            const isSms = d.source === 'sms';
            const elapsed = Date.now() - userSentAtRef.current;
            const delay = elapsed < 900 ? 900 - elapsed : 0;
            setTimeout(() => {
              setIsAITyping(false);
              setMessages(p => {
                const last = p[p.length - 1];
                if (!isSms && last && last.role === 'agent' && !last.text && last.thoughts) {
                  return [...p.slice(0, -1), { ...last, text: d.text }];
                }
                return [...p, { role: 'agent', text: d.text, ...(isSms ? { source: 'sms' as const } : {}) }];
              });
              if (d.text && !isSms) speakRef.current(d.text);
            }, delay);
          }
          else if (d.type === 'user_message' && d.source === 'sms') {
            setMessages(p => [...p, { role: 'user', text: d.text, source: 'sms' }]);
          }
          else if (d.type === 'thought') {
            setIsAITyping(false);
            setMessages(p => {
              const last = p[p.length - 1];
              if (last && last.role === 'agent' && !last.text) {
                return [...p.slice(0, -1), { ...last, thoughts: [...(last.thoughts || []), d.text] }];
              }
              return [...p, { role: 'agent', text: '', thoughts: [d.text] }];
            });
          }
          else if (d.type === 'status') {
            setStatusText(d.text);
            if (d.text === 'Executing') setStatus('executing');
            else if (d.text === 'Idle') setStatus('connected');
            else if (d.text === 'Study Mode') setStatus('connected');
          }
          else if (d.type === 'profile_needed') {
            setIsAITyping(false);
            setMessages(p => [...p, { role: 'agent', text: d.text }]);
            setHighlightFields(d.missing || []);
            setIsProfileOpen(true);
          }
          else if (d.type === 'waiting_for_login') {
            setIsAITyping(false);
            setMessages(p => [...p, { role: 'agent', text: d.text }]);
          }
          else if (d.type === 'study_panel') {
            setIsAITyping(false);
            setStudyData({
              session_id: d.session_id,
              course_name: d.course_name,
              concepts: d.concepts,
              questions: d.questions,
              content_raw: d.content_raw,
            });
            // If we're already in Study Mode (launched from LauncherCard), stay there —
            // the flashcards will come via anki_cards messages. Only switch to quiz view
            // if we're coming from the regular chat flow.
            setMode(m => m === 'study_mode' ? 'study_mode' : 'study');
            // Also populate the subject label from the scraped course name
            if (d.course_name) setStudySubject(prev => prev || d.course_name);
          }
          else if (d.type === 'quiz_start') {
            setIsAITyping(false);
            setQuizData(d);
            setMode('quiz');
          }
          else if (d.type === 'browser_navigate') {
            browserNavigateRef.current?.(d.url);
          }
          else if (d.type === 'study_results') {
            setIsAITyping(false);
            setStudyResults({
              score: d.score,
              total: d.total,
              feedback: d.feedback,
              study_plan: d.study_plan,
              flashcard_questions: d.flashcard_questions ?? [],
            });
            setMode('results');
          }
          else if (d.type === 'study_qa_response') {
            setQaMessages(p => [...p, { role: 'agent', text: d.text }]);
          }
          else if (d.type === 'study_mode_active') {
            setMode('study_mode');
            setStudySubject(d.subject || '');
            // Tell Electron to start blocking sites
            const ipc2 = (window as any).require?.('electron')?.ipcRenderer;
            ipc2?.send('enable-site-blocking');
            setMessages(p => [...p, { role: 'agent', text: d.text }]);
          }
          else if (d.type === 'study_mode_inactive') {
            setAnkiCards([]);
            setOsuResources([]);
            setStudyPlan([]);
            setMode(m => m === 'study_mode' ? 'chat' : m);
            // Tell Electron to stop blocking sites
            const ipc2 = (window as any).require?.('electron')?.ipcRenderer;
            ipc2?.send('disable-site-blocking');
            setMessages(p => [...p, { role: 'agent', text: d.text }]);
          }
          else if (d.type === 'anki_cards') {
            setIsGeneratingCards(false);
            setAnkiCards(d.cards || []);
          }
          else if (d.type === 'osu_resources') {
            setOsuResources(d.resources || []);
          }
          else if (d.type === 'study_plan') {
            setStudyPlan(d.steps || []);
          }
          else if (d.type === 'course_picker') {
            setIsAITyping(false);
            setPendingPlanText(d.text || '');
            setShowCoursePicker(true);
            setCourseInput('');
          }
          else if (d.type === 'course_confirmed') {
            setShowCoursePicker(false);
            setMessages(p => [...p, { role: 'agent', text: d.text }]);
          }
        } catch {
          setIsAITyping(false);
          setMessages(p => [...p, { role: 'agent', text: e.data }]);
        }
      };
    };

    connectWSRef.current = connectWS;
    connectWS();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
        ws.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const wsSend = useCallback((msg: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  const send = useCallback(() => {
    if (!inputText.trim() || !ws.current) return;
    setMessages(p => [...p, { role: 'user', text: inputText }]);
    wsSend({ type: 'user_message', text: inputText });
    setInputText('');
    setIsAITyping(true);
    userSentAtRef.current = Date.now();
    setInputHeight('21px');
    if (textareaRef.current) textareaRef.current.style.height = '21px';
  }, [inputText, wsSend]);

  // ── Mode transitions ──
  const handleStartQuiz = () => {
    if (studyData) {
      setQuizData({
        course: studyData.course_name,
        concepts: studyData.concepts,
        questions: studyData.questions,
      });
      setMode('quiz');
    }
  };

  const handleQuizComplete = (score: number, total: number, wrongQuestions: any[]) => {
    wsSend({
      type: 'quiz_complete',
      score,
      total,
      wrong_questions: wrongQuestions,
      course_name: studyData?.course_name ?? quizData?.course ?? '',
      concepts: studyData?.concepts ?? quizData?.concepts ?? [],
    });
  };

  const handleExitToChat = () => {
    setMode('chat');
    setStudyData(null);
    setQuizData(null);
    setStudyResults(null);
    setQaMessages([]);
  };

  const handleDisableStudyMode = useCallback(() => {
    wsSend({ type: 'study_mode_off' });
    setMode('chat');
  }, [wsSend]);

  const handleStop = useCallback(() => {
    wsSend({ type: 'cancel' });
    setIsAITyping(false);
    setShowCoursePicker(false);
  }, [wsSend]);

  const handleSubmitCourse = useCallback(() => {
    const course = courseInput.trim();
    if (!course) return;
    wsSend({ type: 'set_course', course });
  }, [wsSend, courseInput]);

  const handleConfirmAfterCourse = useCallback(() => {
    wsSend({ type: 'user_message', text: 'yes' });
    setShowCoursePicker(false);
  }, [wsSend]);

  const handleGenerateCards = useCallback(async () => {
    setIsGeneratingCards(true);
    try {
      const ipc2 = (window as any).require?.('electron')?.ipcRenderer;
      let pageText = '';
      if (ipc2) {
        pageText = await ipc2.invoke('get-page-text') || '';
      }
      wsSend({ type: 'generate_cards_from_page', page_text: pageText, subject: studySubject });
    } catch {
      setIsGeneratingCards(false);
    }
  }, [wsSend, studySubject]);

  const handleExitQuiz = () => {
    if (studyData) {
      setMode('study');
      setQuizData(null);
    } else {
      handleExitToChat();
    }
  };

  const statusColors: Record<string, string> = {
    idle: '#b0c8c0', connected: '#80e8b0', executing: '#f0c050', offline: '#f08080',
  };
  const sc = statusColors[status] ?? '#b0c8c0';

  const ipc = typeof window !== 'undefined' ? (window as any).require?.('electron')?.ipcRenderer : null;

  if (showOnboarding === null) return null;

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 14,
      fontFamily: "'DM Sans', sans-serif",
      color: '#f5ecd8',
      background: '#0c1220',
    }}>

      {/* ── LAYERED BACKGROUND ── */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14,
        background: 'linear-gradient(150deg, #0e3535 0%, #123030 18%, #152840 45%, #101828 72%, #0c1220 100%)',
      }} />

      <div style={{ position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-15%', right: '-5%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,180,40,0.28) 0%, transparent 65%)', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,180,150,0.24) 0%, transparent 65%)', filter: 'blur(55px)' }} />
        <div style={{ position: 'absolute', top: '35%', right: '20%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,130,30,0.14) 0%, transparent 70%)', filter: 'blur(35px)' }} />
        <div style={{ position: 'absolute', top: '10%', left: '20%', width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(80,200,180,0.12) 0%, transparent 70%)', filter: 'blur(30px)' }} />
      </div>

      {/* Grain layers */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14,
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'g\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23g)\' opacity=\'1\'/%3E%3C/svg%3E")',
        opacity: 0.22, mixBlendMode: 'overlay', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14,
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'g2\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23g2)\' opacity=\'1\'/%3E%3C/svg%3E")',
        opacity: 0.18, mixBlendMode: 'screen', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14,
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'g3\'%3E%3CfeTurbulence type=\'turbulence\' baseFrequency=\'1.2\' numOctaves=\'1\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23g3)\' opacity=\'1\'/%3E%3C/svg%3E")',
        opacity: 0.13, mixBlendMode: 'soft-light', pointerEvents: 'none',
      }} />

      {/* Stars */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 14, overflow: 'hidden' }}>
        {STARS.map(s => <Star key={s.id} {...s} />)}
      </div>

      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.35) 100%)', pointerEvents: 'none' }} />

      {/* ── OVERLAYS ── */}
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}

      {/* ── ONBOARDING WINDOW CONTROLS (above wizard overlay) ── */}
      {showOnboarding && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 52, zIndex: 70,
          display: 'flex', alignItems: 'center',
          padding: '0 20px',
          ...({ WebkitAppRegion: 'drag' } as any),
        }}>
          <div style={{ display: 'flex', gap: 2, ...({ WebkitAppRegion: 'no-drag' } as any) }}>
            <WinBtn onClick={() => ipc?.send('close-window')} danger><X size={13} /></WinBtn>
            <WinBtn onClick={() => ipc?.send('minimize-window')}><Minus size={13} /></WinBtn>
            <WinBtn onClick={() => ipc?.send('toggle-fullscreen')}><Maximize2 size={13} /></WinBtn>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '15px 20px',
          borderBottom: '2px solid rgba(240,180,60,0.5)',
          flexShrink: 0,
          background: 'rgba(255,255,255,0.025)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 1px 0 rgba(240,180,60,0.12), 0 4px 20px rgba(0,0,0,0.2)',
          ...({ WebkitAppRegion: 'drag', cursor: 'grab' } as any),
        }}
      >
        {/* Left: traffic lights + profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, ...({ WebkitAppRegion: 'no-drag' } as any) }}>
          <WinBtn onClick={() => ipc?.send('close-window')} danger><X size={13} /></WinBtn>
          <WinBtn onClick={() => ipc?.send('minimize-window')}><Minus size={13} /></WinBtn>
          <WinBtn onClick={() => ipc?.send('toggle-fullscreen')}><Maximize2 size={13} /></WinBtn>

          <div style={{ width: 1, height: 16, background: 'rgba(255,240,150,0.12)', margin: '0 8px' }} />

          <motion.button
            whileHover={{ scale: 1.04, background: 'rgba(240,180,60,0.18)' }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setIsProfileOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(240,180,60,0.10)',
              border: '1px solid rgba(240,180,60,0.28)',
              borderRadius: 20, cursor: 'pointer',
              padding: '5px 12px 5px 8px',
              color: '#f0c050',
              transition: 'all 0.2s',
              ...({ WebkitAppRegion: 'no-drag' } as any),
            }}
          >
            <SlidersHorizontal size={12} />
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>Profile</span>
          </motion.button>
        </div>

        {/* Right: TTS + status + brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...({ WebkitAppRegion: 'no-drag' } as any) }}>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={toggleTTS}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isTTSEnabled ? 'rgba(80,200,130,0.12)' : 'transparent',
              border: isTTSEnabled ? '1px solid rgba(80,200,130,0.25)' : '1px solid transparent',
              borderRadius: 8, width: 28, height: 28, cursor: 'pointer',
              color: isTTSEnabled ? '#6ee7a0' : 'rgba(255,240,170,0.25)',
              transition: 'all 0.2s',
              ...({ WebkitAppRegion: 'no-drag' } as any),
            }}
          >
            {isTTSEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </motion.button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5], scale: status === 'executing' ? [0.9, 1.4, 0.9] : [0.8, 1.2, 0.8] }}
              transition={{ duration: status === 'executing' ? 0.7 : 2.2, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: sc, boxShadow: `0 0 10px 2px ${sc}80`, transition: 'background 0.5s' }}
            />
            <span style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: `${sc}cc`, fontWeight: 500, fontFamily: 'monospace', transition: 'color 0.5s' }}>
              {statusText}
            </span>
            {/* Stop button — visible while agent is running */}
            <AnimatePresence>
              {(isAITyping || status === 'executing') && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.08, background: 'rgba(255,80,80,0.18)', color: '#ff8080' }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleStop}
                  title="Stop"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'rgba(255,80,80,0.1)',
                    border: '1px solid rgba(255,80,80,0.25)',
                    borderRadius: 8, padding: '3px 8px',
                    cursor: 'pointer', color: 'rgba(255,140,130,0.8)',
                    fontSize: 10, fontWeight: 500,
                    transition: 'all 0.2s',
                  }}
                >
                  <Square size={9} />
                  <span>Stop</span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* ── Study Mode toggle switch ── */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6, cursor: 'pointer', ...({ WebkitAppRegion: 'no-drag' } as any) }}
              onClick={() => setMode(mode === 'study_mode' ? 'chat' : 'study_mode')}
              title={mode === 'study_mode' ? 'Exit Study Mode' : 'Enter Study Mode'}
            >
              <span style={{ fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: mode === 'study_mode' ? 'rgba(240,180,60,0.9)' : 'rgba(255,255,255,0.25)', fontWeight: 500, transition: 'color 0.25s' }}>Study</span>
              <div style={{
                width: 30, height: 17, borderRadius: 9,
                background: mode === 'study_mode' ? 'rgba(240,180,60,0.55)' : 'rgba(255,255,255,0.1)',
                border: `1px solid ${mode === 'study_mode' ? 'rgba(240,180,60,0.5)' : 'rgba(255,255,255,0.12)'}`,
                position: 'relative', transition: 'background 0.25s, border 0.25s',
                boxShadow: mode === 'study_mode' ? '0 0 10px rgba(240,180,60,0.3)' : 'none',
              }}>
                <motion.div
                  animate={{ x: mode === 'study_mode' ? 13 : 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{
                    position: 'absolute', top: 2, width: 11, height: 11, borderRadius: '50%',
                    background: mode === 'study_mode' ? '#f0c050' : 'rgba(255,255,255,0.4)',
                    boxShadow: mode === 'study_mode' ? '0 0 6px rgba(240,180,60,0.7)' : 'none',
                    transition: 'background 0.25s',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 16, background: 'rgba(255,240,150,0.12)' }} />

          <span style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: 22, fontWeight: 400,
            color: '#ffe8b0',
            letterSpacing: '-0.02em',
            textShadow: '0 0 30px rgba(240,180,60,0.5)',
          }}>
            Say<em style={{ fontStyle: 'italic', opacity: 0.85 }}>am</em>
          </span>
        </div>
      </div>

      {/* ── TWO-PANE LAYOUT (always mounted — preserves chat + AgentBrowser ResizeObserver) ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>

        {/* Profile drawer — left-anchored, only overlays the chat pane, never touches the browser */}
        <ProfileDrawer
          isOpen={isProfileOpen}
          onClose={() => { setIsProfileOpen(false); setHighlightFields([]); }}
          highlightFields={highlightFields}
        />

        {/* ── LEFT PANE (animated width) — always shows chat ── */}
        <motion.div
          initial={{ width: 272 }}
          animate={{ width: sidebarOpen ? 272 : 48 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            flexShrink: 0, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative',
            background: 'rgba(255,255,255,0.035)',
            borderRight: '2px solid rgba(240,180,60,0.5)',
            boxShadow: '4px 0 20px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          {/* Sidebar top bar — collapse toggle only */}
          <div style={{ padding: '8px 8px 4px', display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'flex-end' : 'center', flexShrink: 0 }}>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'rgba(255,240,170,0.4)', width: 28, height: 28, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'color 0.2s', flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,240,170,0.8)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,240,170,0.4)')}
            >
              {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>
          </div>

          {/* Collapsed icon strip */}
          {!sidebarOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 10 }}>
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5], scale: status === 'executing' ? [0.9, 1.4, 0.9] : [0.8, 1.2, 0.8] }}
                transition={{ duration: status === 'executing' ? 0.7 : 2.2, repeat: Infinity }}
                style={{ width: 7, height: 7, borderRadius: '50%', background: sc, boxShadow: `0 0 10px 2px ${sc}80` }}
              />
              <button
                onClick={() => setIsProfileOpen(true)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(240,180,60,0.5)', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <SlidersHorizontal size={14} />
              </button>
              <button
                onClick={toggleTTS}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isTTSEnabled ? '#6ee7a0' : 'rgba(255,240,170,0.3)', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {isTTSEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              <button
                onClick={() => setMode('study_mode')}
                title="Study Sessions"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(240,180,60,0.5)', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <BookOpen size={14} />
              </button>
            </div>
          )}

          {/* Chat content — fades when sidebar collapses */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
              >
                {/* ── CHAT WORKSPACE ── */}
                <div style={{
                  position: 'relative', zIndex: 5,
                  flex: 1, overflowY: 'auto',
                  padding: '22px 22px 10px',
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  <AnimatePresence>
                    {messages.length === 0 && (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 18, textAlign: 'center', paddingBottom: 24 }}
                      >
                        <motion.div
                          animate={{ y: [0, -8, 0], filter: ['drop-shadow(0 0 12px rgba(240,180,60,0.6))', 'drop-shadow(0 0 28px rgba(240,180,60,0.9))', 'drop-shadow(0 0 12px rgba(240,180,60,0.6))'] }}
                          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                          style={{ fontSize: 42, color: '#f0c050', lineHeight: 1 }}
                        >✦</motion.div>

                        <div>
                          <h1 style={{
                            fontFamily: "'Instrument Serif', serif",
                            fontSize: 30, fontWeight: 400, fontStyle: 'normal',
                            color: '#fff0d0',
                            letterSpacing: '-0.03em', lineHeight: 1.2,
                            textShadow: '0 2px 30px rgba(240,180,60,0.3)',
                          }}>
                            Let's get<br />
                            to <em style={{ fontStyle: 'italic', fontSize: 36, color: '#ffe098' }}>work.</em>
                          </h1>
                          <p style={{
                            marginTop: 12,
                            fontSize: 11.5, letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            color: 'rgba(200,235,220,0.4)',
                            fontWeight: 400,
                          }}>
                            career &nbsp;·&nbsp; academics
                          </p>
                        </div>

                        <motion.div
                          whileHover={{ scale: 1.015, borderColor: 'rgba(240,180,60,0.4)' }}
                          onClick={() => setIsProfileOpen(true)}
                          style={{
                            width: '100%', maxWidth: 360,
                            background: 'rgba(240,180,60,0.06)',
                            border: '1px solid rgba(240,180,60,0.2)',
                            borderRadius: 14, padding: '14px 20px',
                            cursor: 'pointer', display: 'flex',
                            alignItems: 'center', gap: 14,
                            transition: 'all 0.2s',
                          }}
                        >
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(240,180,60,0.12)', border: '1px solid rgba(240,180,60,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <SlidersHorizontal size={16} style={{ color: '#f0c050' }} />
                          </div>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <p style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'normal', fontSize: 14, color: '#ffe8b0', marginBottom: 3 }}>
                              Set up your <em style={{ fontStyle: 'italic' }}>profile</em>
                            </p>
                            <p style={{ fontSize: 11.5, color: 'rgba(200,230,210,0.45)', lineHeight: 1.5 }}>
                              Upload your resume so Sayam can tailor job applications & study plans to you
                            </p>
                          </div>
                          <div style={{ color: 'rgba(240,180,60,0.45)', fontSize: 18, flexShrink: 0 }}>→</div>
                        </motion.div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {['"Apply to relevant internships"', '"I have an exam tomorrow"', '"Enter study mode"'].map(chip => (
                            <motion.button
                              key={chip}
                              whileHover={{ scale: 1.03, background: 'rgba(240,180,60,0.12)' }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => { setInputText(chip.replace(/"/g, '')); }}
                              style={{
                                background: 'rgba(255,240,180,0.06)',
                                border: '1px solid rgba(240,180,60,0.2)',
                                borderRadius: 40,
                                padding: '7px 16px',
                                fontSize: 12,
                                color: 'rgba(255,230,160,0.7)',
                                cursor: 'pointer',
                                fontFamily: "'DM Sans', sans-serif",
                                fontStyle: 'italic',
                                transition: 'all 0.2s',
                              }}
                            >
                              {chip}
                            </motion.button>
                          ))}
                          <motion.button
                            whileHover={{ scale: 1.03, background: 'rgba(240,180,60,0.12)' }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setMode('study_mode')}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              background: 'rgba(255,240,180,0.06)',
                              border: '1px solid rgba(240,180,60,0.2)',
                              borderRadius: 40, padding: '7px 14px',
                              fontSize: 12, color: 'rgba(255,230,160,0.7)',
                              cursor: 'pointer', transition: 'all 0.2s',
                              fontFamily: "'DM Sans', sans-serif",
                            }}
                          >
                            <BookOpen size={12} />
                            <span>View saved study sessions</span>
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                      style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}
                    >
                      {msg.role === 'agent' && (
                        <p style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontStyle: 'normal',
                          fontSize: 10, letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'rgba(240,200,100,0.55)',
                          marginBottom: 5, paddingLeft: 4,
                          fontWeight: 400,
                        }}>SAYAM</p>
                      )}
                      <div style={{
                        padding: '11px 16px',
                        borderRadius: msg.role === 'user' ? '20px 20px 5px 20px' : '5px 20px 20px 20px',
                        background: msg.role === 'user'
                          ? 'linear-gradient(135deg, rgba(200,150,40,0.4), rgba(150,110,30,0.28))'
                          : 'rgba(255,255,255,0.05)',
                        border: msg.role === 'user'
                          ? '1px solid rgba(240,180,60,0.3)'
                          : '1px solid rgba(255,255,255,0.07)',
                        fontSize: 13.5, lineHeight: 1.7,
                        color: msg.role === 'user' ? '#fff0cc' : '#cce0d8',
                        backdropFilter: 'blur(12px)',
                        whiteSpace: 'pre-wrap',
                        boxShadow: msg.role === 'user'
                          ? '0 2px 16px rgba(200,140,20,0.15)'
                          : '0 2px 12px rgba(0,0,0,0.25)',
                      }}>
                        {(msg.thoughts && msg.thoughts.length > 0) ? (
                          <ThoughtBox thoughts={msg.thoughts} complete={!!msg.text} />
                        ) : null}
                        {msg.text && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 }}>
                            <span style={{ flex: 1, minWidth: 0 }}>{renderMarkdown(msg.text)}</span>
                            {msg.source === 'sms' && <SmsBadge />}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {/* Typing indicator */}
                  <AnimatePresence>
                    {isAITyping && (
                      <motion.div
                        key="typing"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        style={{ alignSelf: 'flex-start', maxWidth: '80%' }}
                      >
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,200,100,0.55)', marginBottom: 5, paddingLeft: 4, fontWeight: 400 }}>SAYAM</p>
                        <div style={{ padding: '14px 18px', borderRadius: '5px 20px 20px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}>
                          <TypingDots />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div ref={bottomRef} />

                  {/* ── Course Picker Card ── */}
                  <AnimatePresence>
                    {showCoursePicker && (
                      <motion.div
                        key="course-picker"
                        initial={{ opacity: 0, y: 12, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                        style={{ alignSelf: 'flex-start', width: '100%', maxWidth: '88%' }}
                      >
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,200,100,0.55)', marginBottom: 5, paddingLeft: 4, fontWeight: 400 }}>SAYAM</p>
                        <div style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '5px 20px 20px 20px',
                          backdropFilter: 'blur(16px)',
                          padding: '16px 18px',
                          display: 'flex', flexDirection: 'column', gap: 12,
                        }}>
                          {/* Plan preview */}
                          <pre style={{ margin: 0, fontSize: 12, color: '#cce0d8', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: "'DM Sans', sans-serif" }}>
                            {pendingPlanText}
                          </pre>

                          {/* Divider */}
                          <div style={{ height: 1, background: 'rgba(240,180,60,0.15)' }} />

                          {/* Course input */}
                          <div>
                            <p style={{ fontSize: 11, color: 'rgba(240,200,100,0.7)', marginBottom: 8, fontWeight: 500 }}>Which course are you studying for?</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input
                                autoFocus
                                value={courseInput}
                                onChange={e => setCourseInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && courseInput.trim() && handleSubmitCourse()}
                                placeholder="e.g. CSE 2421, MATH 1151..."
                                style={{
                                  flex: 1,
                                  background: 'rgba(255,255,255,0.07)',
                                  border: '1px solid rgba(240,180,60,0.25)',
                                  borderRadius: 10, padding: '7px 12px',
                                  fontSize: 12, color: '#f0e8d0',
                                  outline: 'none', fontFamily: "'DM Sans', sans-serif",
                                }}
                              />
                              <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={handleSubmitCourse}
                                disabled={!courseInput.trim()}
                                style={{
                                  background: courseInput.trim() ? 'linear-gradient(135deg, #d4a030, #a07020)' : 'rgba(255,255,255,0.07)',
                                  border: 'none', borderRadius: 10, padding: '7px 14px',
                                  color: courseInput.trim() ? '#fff8e0' : 'rgba(255,240,180,0.3)',
                                  fontSize: 12, fontWeight: 500, cursor: courseInput.trim() ? 'pointer' : 'default',
                                  transition: 'all 0.2s',
                                }}
                              >Set</motion.button>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={handleStop}
                              style={{
                                background: 'transparent', border: '1px solid rgba(255,80,80,0.2)',
                                borderRadius: 10, padding: '6px 14px', fontSize: 11,
                                color: 'rgba(255,140,130,0.65)', cursor: 'pointer',
                              }}
                            >Cancel</motion.button>
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={handleConfirmAfterCourse}
                              style={{
                                background: 'linear-gradient(135deg, rgba(200,150,40,0.35), rgba(150,110,30,0.25))',
                                border: '1px solid rgba(240,180,60,0.3)',
                                borderRadius: 10, padding: '6px 16px', fontSize: 11,
                                color: '#ffe8b0', cursor: 'pointer', fontWeight: 500,
                              }}
                            >Proceed →</motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── GRADIENT DIVIDER ── */}
                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(240,180,60,0.22) 25%, rgba(240,180,60,0.22) 75%, transparent)', flexShrink: 0, position: 'relative', zIndex: 5 }} />

                {/* ── INPUT BAR ── */}
                <div style={{ position: 'relative', zIndex: 10, padding: '14px 18px 20px', flexShrink: 0 }}>
                  <motion.div
                    animate={{
                      boxShadow: focused
                        ? '0 0 0 1.5px rgba(240,180,60,0.35), 0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.25)',
                    }}
                    style={{
                      display: 'flex', alignItems: 'flex-end', gap: 6,
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: 16,
                      border: `1px solid ${focused ? 'rgba(240,180,60,0.28)' : 'rgba(255,255,255,0.08)'}`,
                      padding: '10px 10px 10px 16px',
                      backdropFilter: 'blur(20px)',
                      transition: 'border-color 0.3s',
                    }}
                  >
                    <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={e => {
                        setInputText(e.target.value);
                        e.target.style.height = 'auto';
                        const h = Math.min(e.target.scrollHeight, 120);
                        e.target.style.height = h + 'px';
                        setInputHeight(h + 'px');
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      placeholder="Ask anything..."
                      style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        fontSize: 14, color: '#f0e8d0',
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 300, letterSpacing: '0.01em',
                        resize: 'none', overflow: 'hidden',
                        padding: 0, height: inputHeight, maxHeight: 120, lineHeight: 1.5,
                      }}
                    />

                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={toggleListening}
                      style={{
                        background: isListening ? 'rgba(240,180,60,0.18)' : 'transparent',
                        border: isListening ? '1px solid rgba(240,180,60,0.3)' : 'none',
                        cursor: 'pointer',
                        color: isListening ? '#f0c050' : 'rgba(255,240,180,0.35)',
                        width: 36, height: 36, borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s', flexShrink: 0,
                      }}
                    >
                      {isListening
                        ? <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }}><Mic size={15} /></motion.div>
                        : <Mic size={15} />}
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={send}
                      style={{
                        background: inputText.trim()
                          ? 'linear-gradient(135deg, #d4a030, #a07020)'
                          : 'rgba(255,255,255,0.05)',
                        border: 'none', cursor: 'pointer',
                        color: inputText.trim() ? '#fff8e0' : 'rgba(255,240,180,0.25)',
                        width: 36, height: 36, borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: inputText.trim() ? '0 4px 16px rgba(200,140,20,0.35)' : 'none',
                        transition: 'all 0.2s', flexShrink: 0,
                      }}
                    >
                      <ArrowUp size={16} />
                    </motion.button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── RIGHT PANE — browser + study mode page + career/notes dashboards ── */}
        {!showOnboarding && (
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Study Mode Full Page — sits above the browser when active */}
            <AnimatePresence>
              {mode === 'study_mode' && (
                <StudyModePage
                  blockedCount={11}
                  subject={studySubject}
                  ankiCards={ankiCards}
                  osuResources={osuResources}
                  isGeneratingCards={isGeneratingCards}
                  onDisable={handleDisableStudyMode}
                  onGenerateCards={handleGenerateCards}
                  wsSend={wsSend}
                  studyPlan={studyPlan}
                />
              )}
            </AnimatePresence>
            {/* AgentBrowser — hidden visually during study_mode but kept mounted */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', visibility: mode === 'study_mode' ? 'hidden' : 'visible', position: mode === 'study_mode' ? 'absolute' : 'relative', width: '100%', height: '100%' }}>
              <AgentBrowser
                navigateRef={browserNavigateRef}
                forceUpdateRef={browserForceUpdateRef}
                onOpenCareerDashboard={() => setIsCareerDashboardOpen(true)}
                onOpenNotesDashboard={() => setIsNotesDashboardOpen(true)}
              />
            </div>
            {/* Career & Notes dashboard overlays */}
            <CareerDashboard
              isOpen={isCareerDashboardOpen}
              onClose={() => setIsCareerDashboardOpen(false)}
            />
            <NotesDashboard
              isOpen={isNotesDashboardOpen}
              onClose={() => setIsNotesDashboardOpen(false)}
            />
          </div>
        )}

        {/* ── STUDY OVERLAY (covers only content area — header stays visible) ── */}
        <AnimatePresence>
          {(mode !== 'chat' && mode !== 'study_mode') && (
            <motion.div
              key="study-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'absolute', inset: 0, zIndex: 20,
                display: 'flex', flexDirection: 'column',
                background: 'linear-gradient(150deg, #0e3535 0%, #123030 18%, #152840 45%, #101828 72%, #0c1220 100%)',
              }}
            >
              {mode === 'study' && studyData && (
                <StudyPanel
                  fullScreen
                  courseName={studyData.course_name}
                  concepts={studyData.concepts}
                  qaMessages={qaMessages}
                  onStartQuiz={handleStartQuiz}
                  onBack={handleExitToChat}
                  onSendQA={(question: string) => {
                    setQaMessages(p => [...p, { role: 'user', text: question }]);
                    wsSend({ type: 'study_qa', text: question, context: studyData.content_raw });
                  }}
                />
              )}
              {mode === 'quiz' && quizData && (
                <QuizView
                  fullScreen
                  data={quizData}
                  onClose={handleExitQuiz}
                  onQuizComplete={handleQuizComplete}
                />
              )}
              {mode === 'results' && studyResults && (
                <StudyResults
                  fullScreen
                  data={studyResults}
                  onClose={handleExitToChat}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

    </div>
  );
}

export default App;
