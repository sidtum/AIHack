import { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, ArrowUp, Minus, X, SlidersHorizontal, ChevronRight, Volume2, VolumeX, Maximize2, Square, BookOpen, Briefcase, FileText, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import MayaLogo from './assets/logo.jpg';
import { ProfileDrawer } from './components/ProfileDrawer';
import { QuizView } from './components/QuizView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { StudyPanel } from './components/StudyPanel';
import { StudyResults, StudyResultsData } from './components/StudyResults';
import { AgentBrowser } from './components/AgentBrowser';
import { CareerDashboard } from './components/CareerDashboard';
import { NotesDashboard } from './components/NotesDashboard';
import { CourseTrackerPage } from './components/CourseTrackerPage';
import { SmsBadge } from './components/SmsBadge';
import { StudyModePage } from './components/StudyModePage';
import Aurora from './components/Aurora';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useTTS } from './hooks/useTTS';

// ─── Types ──────────────────────────────────────────────────────────────────
type AppMode = 'chat' | 'study' | 'quiz' | 'results' | 'study_mode';

interface Message {
  role: 'user' | 'agent';
  text: string;
  thoughts?: string[];
  completionText?: string;
  source?: 'sms';
}

interface StudyData {
  session_id: number;
  course_name: string;
  concepts: any[];
  questions: any[];
  content_raw: string;
}

// ─── Design tokens (inline references) ────────────────────────────────────
const C = {
  bg: '#141B2D',
  surface: '#1A2238',
  elevated: '#202840',
  textPrimary: '#F5EDD8',
  textSecond: '#A89E8A',
  textDim: '#6B6258',
  accent: '#D4AF6C',
  accentBright: '#E8C97E',
  teal: '#89CEC2',
  borderGold: 'rgba(212, 175, 108, 0.14)',
  borderGlass: 'rgba(245, 237, 216, 0.08)',
  glass: 'rgba(26, 34, 56, 0.65)',
};

// ─── Window control button ─────────────────────────────────────────────────
function WinBtn({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: h ? (danger ? 'rgba(212, 70, 70, 0.22)' : 'rgba(212, 175, 108, 0.1)') : 'transparent',
        border: 'none', cursor: 'pointer',
        color: h ? (danger ? '#D47070' : C.accent) : 'rgba(212, 175, 108, 0.25)',
        width: 26, height: 26, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s', flexShrink: 0,
        ...({ WebkitAppRegion: 'no-drag' } as any),
      }}
    >
      {children}
    </button>
  );
}

// ─── CSS Status Orb (replaces Three.js MayaOrb) ───────────────────────────
type OrbStatus = 'idle' | 'connected' | 'thinking' | 'executing' | 'offline';
function StatusOrb({ status }: { status: OrbStatus }) {
  const colorMap: Record<OrbStatus, string> = {
    idle: '#8A9EB0',
    connected: '#7DD8B8',
    thinking: '#D4AF6C',
    executing: '#E8C97E',
    offline: '#D47070',
  };
  const color = colorMap[status] ?? colorMap.idle;
  const isActive = status === 'thinking' || status === 'executing';
  return (
    <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
      {/* Pulse ring */}
      {isActive && (
        <motion.div
          animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
          transition={{ duration: status === 'executing' ? 0.7 : 1.4, repeat: Infinity, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            background: color,
          }}
        />
      )}
      {/* Core dot */}
      <motion.div
        animate={isActive
          ? { scale: [1, 1.15, 1], boxShadow: [`0 0 4px ${color}`, `0 0 12px ${color}`, `0 0 4px ${color}`] }
          : { scale: 1, boxShadow: `0 0 6px ${color}60` }
        }
        transition={isActive ? { duration: status === 'executing' ? 0.6 : 1.4, repeat: Infinity, ease: 'easeInOut' } : {}}
        style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}60`,
        }}
      />
    </div>
  );
}

// ─── Voice lines loader ──────────────────────────────────────────────────
function SkeletonLines() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 20, padding: '4px 0', minHeight: 20 }}>
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          animate={{ height: [6, 16, 6] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          style={{ width: 3, borderRadius: 2, background: 'rgba(212,175,108,0.7)' }}
        />
      ))}
    </div>
  );
}

// ─── Thought Box Component ─────────────────────────────────────────────────
function ThoughtBox({ thoughts, complete }: { thoughts: string[]; complete: boolean }) {
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current && open) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts, open]);

  return (
    <div style={{
      marginBottom: complete ? 10 : 6,
      padding: '7px 11px',
      background: 'rgba(212, 175, 108, 0.04)',
      borderRadius: 10,
      border: '1px solid rgba(212, 175, 108, 0.1)',
    }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, userSelect: 'none' }}
      >
        {!complete ? (
          <motion.div
            animate={{ scale: [0.7, 1.3, 0.7], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.teal, flexShrink: 0 }} />
        )}
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontStyle: 'italic',
          fontSize: 10.5,
          color: complete ? 'rgba(137, 206, 194, 0.5)' : 'rgba(212, 175, 108, 0.5)',
          flex: 1,
          letterSpacing: '0.03em',
        }}>
          {complete ? `${thoughts.length} step${thoughts.length !== 1 ? 's' : ''} completed` : 'Reasoning…'}
        </span>
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.15 }} style={{ color: 'rgba(212, 175, 108, 0.3)', flexShrink: 0 }}>
          <ChevronRight size={10} />
        </motion.div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden' }}
          >
            <div ref={scrollRef} style={{
              paddingTop: 7,
              display: 'flex', flexDirection: 'column', gap: 3,
              maxHeight: 200, overflowY: 'auto', overflowX: 'hidden',
            }}>
              {thoughts.map((t, i) => (
                <div key={i} style={{
                  fontSize: 10.5,
                  color: 'rgba(212, 175, 108, 0.35)',
                  paddingLeft: 13,
                  lineHeight: 1.55,
                  wordBreak: 'break-word',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
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
      return <strong key={i} style={{ fontWeight: 600, color: C.textPrimary }}>{seg.slice(2, -2)}</strong>;
    if (seg.startsWith('*') && seg.endsWith('*'))
      return <em key={i} style={{ fontStyle: 'italic', color: C.accentBright }}>{seg.slice(1, -1)}</em>;
    return seg;
  });
}

// ─── Top bar nav tab ───────────────────────────────────────────────────────
function NavTab({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '5px 10px',
        borderRadius: 8,
        color: active ? C.accent : h ? 'rgba(245, 237, 216, 0.65)' : 'rgba(245, 237, 216, 0.35)',
        fontSize: 12,
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: active ? 500 : 400,
        letterSpacing: '0.02em',
        position: 'relative',
        transition: 'color 0.2s',
        flexShrink: 0,
        ...({ WebkitAppRegion: 'no-drag' } as any),
      }}
    >
      {icon && <span style={{ opacity: active ? 1 : 0.7 }}>{icon}</span>}
      {label}
      {active && (
        <motion.div
          layoutId="nav-underline"
          style={{
            position: 'absolute',
            bottom: 0, left: 10, right: 10,
            height: 1.5,
            background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
            borderRadius: 2,
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
    </button>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────
function App() {
  const [status, setStatus] = useState<'idle' | 'connected' | 'executing' | 'offline'>('idle');
  const [statusText, setStatusText] = useState('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCareerDashboardOpen, setIsCareerDashboardOpen] = useState(false);
  const [isNotesDashboardOpen, setIsNotesDashboardOpen] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isCourseTrackerOpen, setIsCourseTrackerOpen] = useState(false);
  const [highlightFields, setHighlightFields] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [focused, setFocused] = useState(false);
  const [inputHeight, setInputHeight] = useState('21px');
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
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
  useLayoutEffect(() => {
    const ipc = (window as any).require?.('electron')?.ipcRenderer;
    if (mode !== 'chat' || isCareerDashboardOpen || isNotesDashboardOpen || isCourseTrackerOpen) {
      ipc?.send('hide-browser');
    } else {
      browserForceUpdateRef.current?.();
    }
  }, [mode, isCareerDashboardOpen, isNotesDashboardOpen, isCourseTrackerOpen]);

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
                if (!isSms && last && last.role === 'agent' && last.source === 'sms' && last.thoughts?.length) {
                  return [...p.slice(0, -1), { ...last, completionText: d.text }];
                }
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
              if (last && last.role === 'agent' && (!last.text || last.source === 'sms')) {
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
            setMode(m => m === 'study_mode' ? 'study_mode' : 'study');
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
            setMode(prev => {
              if (prev === 'study_mode') {
                if (d.study_plan?.length > 0) {
                  setStudyPlan(
                    (d.study_plan as string[]).map((text: string, i: number) => ({ step: i + 1, text }))
                  );
                }
                return 'study_mode';
              }
              return 'results';
            });
          }
          else if (d.type === 'study_qa_response') {
            setQaMessages(p => [...p, { role: 'agent', text: d.text }]);
          }
          else if (d.type === 'study_mode_active') {
            setMode('study_mode');
            setIsCareerDashboardOpen(false);
            setIsNotesDashboardOpen(false);
            setStudySubject(d.subject || '');
            const ipc2 = (window as any).require?.('electron')?.ipcRenderer;
            ipc2?.send('enable-site-blocking');
            setMessages(p => [...p, { role: 'agent', text: d.text }]);
          }
          else if (d.type === 'study_mode_inactive') {
            setAnkiCards([]);
            setOsuResources([]);
            setStudyPlan([]);
            setMode(m => m === 'study_mode' ? 'chat' : m);
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

  // Orb status mapping
  const orbStatus: OrbStatus = status === 'executing' ? 'executing' : isAITyping ? 'thinking' : status === 'connected' ? 'connected' : status === 'offline' ? 'offline' : 'idle';

  const ipc = typeof window !== 'undefined' ? (window as any).require?.('electron')?.ipcRenderer : null;

  if (showOnboarding === null) return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0E1628 0%, #141B2D 50%, #131822 100%)',
      color: 'rgba(212,175,108,0.5)', fontFamily: "'DM Sans', sans-serif", fontSize: 13,
      letterSpacing: '0.12em', textTransform: 'uppercase',
    }}>
      Maya
    </div>
  );

  // Is the browser pane actively visible?


  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
      borderRadius: 14,
      fontFamily: "'DM Sans', sans-serif",
      color: C.textPrimary,
      background: C.bg,
    }}>

      {/* ── BACKGROUND STACK ── */}
      {/* Base gradient */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14, zIndex: 0,
        background: `linear-gradient(160deg,
          #0E1628 0%,
          #141B2D 30%,
          #161F30 60%,
          #131822 80%,
          #111520 100%
        )`,
      }} />

      {/* Subtle radial vignette */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14, zIndex: 1, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(8, 11, 20, 0.5) 100%)',
      }} />

      {/* ── OVERLAYS ── */}
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
      )}

      {/* ── ONBOARDING WINDOW CONTROLS ── */}
      {showOnboarding && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 42, zIndex: 70,
          display: 'flex', alignItems: 'center',
          padding: '0 16px',
          ...({ WebkitAppRegion: 'drag' } as any),
        }}>
          <div style={{ display: 'flex', gap: 2, ...({ WebkitAppRegion: 'no-drag' } as any) }}>
            <WinBtn onClick={() => ipc?.send('close-window')} danger><X size={12} /></WinBtn>
            <WinBtn onClick={() => ipc?.send('minimize-window')}><Minus size={12} /></WinBtn>
            <WinBtn onClick={() => ipc?.send('toggle-fullscreen')}><Maximize2 size={12} /></WinBtn>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ── UNIFIED TOP BAR ──
          Left: window controls + Maya wordmark + mode tabs
          Center/Right: browser controls (when browser visible) + status + controls
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', alignItems: 'center',
          height: 42,
          padding: '0 14px',
          background: 'rgba(14, 22, 40, 0.88)',
          backdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${C.borderGold}`,
          boxShadow: '0 1px 0 rgba(212, 175, 108, 0.06), 0 4px 24px rgba(0, 0, 0, 0.3)',
          flexShrink: 0,
          gap: 6,
          overflow: 'hidden',
          ...({ WebkitAppRegion: 'drag', cursor: 'grab' } as any),
        }}
      >
        {/* Ambient Aurora behind header */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          opacity: 0.35,
        }}>
          <Aurora colorStops={['#FFD875', '#4ECDC4', '#C77DFF']} blend={0.6} amplitude={0.9} speed={0.4} />
        </div>

        {/* Left: window controls */}
        <div style={{ display: 'flex', gap: 2, ...({ WebkitAppRegion: 'no-drag' } as any) }}>
          <WinBtn onClick={() => ipc?.send('close-window')} danger><X size={12} /></WinBtn>
          <WinBtn onClick={() => ipc?.send('minimize-window')}><Minus size={12} /></WinBtn>
          <WinBtn onClick={() => ipc?.send('toggle-fullscreen')}><Maximize2 size={12} /></WinBtn>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 18, background: C.borderGold, marginLeft: 4, marginRight: 8, flexShrink: 0 }} />

        {/* Maya Wordmark with Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8, flexShrink: 0, ...({ WebkitAppRegion: 'no-drag' } as any) }}>
          <img src={MayaLogo} alt="Maya Logo" style={{ width: 22, height: 22 }} />
          <span style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: 'normal',
            fontSize: 22,
            fontWeight: 400,
            color: C.accent,
            letterSpacing: '0.01em',
            textShadow: `0 2px 12px rgba(212, 175, 108, 0.3)`,
            lineHeight: 1,
          }}>
            Maya
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 18, background: C.borderGold, marginRight: 4, flexShrink: 0 }} />

        {/* Mode Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 1, ...({ WebkitAppRegion: 'no-drag' } as any) }}>
          <NavTab
            label="Chat"
            active={mode === 'chat' && !isCareerDashboardOpen && !isNotesDashboardOpen}
            onClick={() => { setMode('chat'); setIsCareerDashboardOpen(false); setIsNotesDashboardOpen(false); }}
          />
          <NavTab
            label="Career"
            active={isCareerDashboardOpen}
            onClick={() => { setIsCareerDashboardOpen(true); setIsNotesDashboardOpen(false); setMode('chat'); }}
            icon={<Briefcase size={11} />}
          />
          <NavTab
            label="Study"
            active={mode === 'study_mode'}
            onClick={() => { setMode(mode === 'study_mode' ? 'chat' : 'study_mode'); setIsCareerDashboardOpen(false); setIsNotesDashboardOpen(false); }}
            icon={<BookOpen size={11} />}
          />
          <NavTab
            label="Notes"
            active={isNotesDashboardOpen}
            onClick={() => { setIsNotesDashboardOpen(true); setIsCareerDashboardOpen(false); setMode('chat'); }}
            icon={<FileText size={11} />}
          />
        </div>

        {/* Flex spacer */}
        <div style={{ flex: 1 }} />

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...({ WebkitAppRegion: 'no-drag' } as any) }}>

          {/* Stop button */}
          <AnimatePresence>
            {(isAITyping || status === 'executing') && (
              <motion.button
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStop}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'rgba(212, 70, 70, 0.1)',
                  border: '1px solid rgba(212, 70, 70, 0.25)',
                  borderRadius: 8, padding: '4px 9px',
                  cursor: 'pointer',
                  color: 'rgba(212, 112, 112, 0.85)',
                  fontSize: 10, fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  transition: 'all 0.2s',
                }}
              >
                <Square size={8} />
                <span>Stop</span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* TTS toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTTS}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isTTSEnabled ? 'rgba(137, 206, 194, 0.1)' : 'transparent',
              border: isTTSEnabled ? '1px solid rgba(137, 206, 194, 0.2)' : '1px solid transparent',
              borderRadius: 7, width: 28, height: 28, cursor: 'pointer',
              color: isTTSEnabled ? C.teal : 'rgba(245, 237, 216, 0.25)',
              transition: 'all 0.2s',
            }}
          >
            {isTTSEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
          </motion.button>

          {/* Separator */}
          <div style={{ width: 1, height: 18, background: C.borderGold }} />

          {/* Status orb + label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusOrb status={orbStatus} />
            <span style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: status === 'executing' ? `rgba(212, 175, 108, 0.7)` : status === 'connected' ? `rgba(125, 216, 184, 0.6)` : status === 'offline' ? `rgba(212, 112, 112, 0.6)` : `rgba(138, 158, 176, 0.5)`,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 300,
              transition: 'color 0.5s',
              flexShrink: 0,
            }}>
              {statusText}
            </span>
          </div>
        </div>
      </div>

      {/* ── TWO-PANE LAYOUT ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>

        {/* Profile drawer */}
        <ProfileDrawer
          isOpen={isProfileOpen}
          onClose={() => { setIsProfileOpen(false); setHighlightFields([]); }}
          highlightFields={highlightFields}
          onOpenCourseTracker={() => { setIsProfileOpen(false); setHighlightFields([]); setIsCourseTrackerOpen(true); }}
        />

        {/* ── LEFT PANE — Chat sidebar ── */}
        <motion.div
          animate={{ width: isChatCollapsed ? 48 : 230 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            flexShrink: 0, minHeight: 0,
            display: 'flex', flexDirection: 'column',
            position: 'relative',
            background: 'rgba(10, 15, 28, 0.7)',
            borderRight: `1px solid ${C.borderGold}`,
            boxShadow: '4px 0 40px rgba(0, 0, 0, 0.45)',
            overflow: 'hidden',
          }}
        >
          {/* Aurora ambient background behind chat */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
            opacity: 0.65,
          }}>
            <Aurora
              colorStops={['#FFD875', '#4ECDC4', '#C77DFF']}
              blend={0.55}
              amplitude={1.3}
              speed={0.45}
            />
          </div>
          {/* Subtle dark overlay — just enough to keep text readable */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(8,12,24,0.3) 0%, rgba(8,12,24,0.15) 40%, rgba(8,12,24,0.45) 100%)',
          }} />

          {/* Chat content & Sidebar Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative', zIndex: 2 }}>

            {/* Sidebar Header (Controls) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isChatCollapsed ? 'center' : 'space-between',
              padding: isChatCollapsed ? '12px 0' : '12px 14px',
              borderBottom: `1px solid rgba(255,255,255,0.05)`,
              flexDirection: isChatCollapsed ? 'column' : 'row',
              gap: isChatCollapsed ? 12 : 0,
            }}>
              {!isChatCollapsed && (
                <span style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.14em', fontFamily: "'JetBrains Mono', monospace" }}>
                  Assistant
                </span>
              )}
              <div style={{ display: 'flex', flexDirection: isChatCollapsed ? 'column' : 'row', gap: 6 }}>
                <button
                  title="Profile"
                  onClick={() => setIsProfileOpen(true)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'rgba(212, 175, 108, 0.65)', width: 24, height: 24,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 6, transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212, 175, 108, 0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <SlidersHorizontal size={14} />
                </button>
                <button
                  title={isChatCollapsed ? "Expand Chat" : "Minimize Chat"}
                  onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: C.textDim, width: 24, height: 24,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 6, transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = C.textPrimary; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textDim; }}
                >
                  {isChatCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                </button>
              </div>
            </div>

            {/* ── CHAT WORKSPACE ── */}
            <div style={{
              position: 'relative', zIndex: 5,
              flex: 1, overflowY: 'auto',
              padding: '20px 18px 10px',
              display: isChatCollapsed ? 'none' : 'flex', flexDirection: 'column', gap: 12,
            }}>
              <AnimatePresence>
                {messages.length === 0 && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      flex: 1, gap: 20, textAlign: 'center',
                      paddingBottom: 20,
                    }}
                  >
                    {/* Floating Maya mark */}
                    <motion.div
                      animate={{
                        y: [0, -7, 0],
                        filter: [
                          'drop-shadow(0 0 10px rgba(212, 175, 108, 0.5))',
                          'drop-shadow(0 0 22px rgba(212, 175, 108, 0.8))',
                          'drop-shadow(0 0 10px rgba(212, 175, 108, 0.5))',
                        ]
                      }}
                      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <span style={{
                        fontFamily: "'Instrument Serif', serif",
                        fontStyle: 'italic',
                        fontSize: 38,
                        color: C.accent,
                        lineHeight: 1,
                        display: 'block',
                      }}>M</span>
                    </motion.div>

                    <div>
                      <h1 style={{
                        fontFamily: "'Instrument Serif', serif",
                        fontSize: 24, fontWeight: 400,
                        color: C.textPrimary,
                        letterSpacing: '-0.03em', lineHeight: 1.25,
                      }}>
                        Let's get to{' '}
                        <em style={{ fontStyle: 'italic', color: C.accent }}>work.</em>
                      </h1>
                      <p style={{
                        marginTop: 10,
                        fontSize: 10.5, letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: 'rgba(168, 158, 138, 0.45)',
                        fontWeight: 400,
                      }}>
                        career &nbsp;·&nbsp; academics &nbsp;·&nbsp; study
                      </p>
                    </div>

                    {/* Profile card */}
                    <motion.div
                      whileHover={{ scale: 1.015 }}
                      onClick={() => setIsProfileOpen(true)}
                      style={{
                        width: '100%',
                        background: 'rgba(212, 175, 108, 0.04)',
                        border: `1px solid ${C.borderGold}`,
                        borderRadius: 14, padding: '12px 16px',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'rgba(212, 175, 108, 0.1)',
                        border: `1px solid ${C.borderGold}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <SlidersHorizontal size={15} style={{ color: C.accent }} />
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <p style={{
                          fontFamily: "'Instrument Serif', serif",
                          fontSize: 13, color: C.textPrimary, marginBottom: 2,
                        }}>
                          Set up your <em style={{ fontStyle: 'italic' }}>profile</em>
                        </p>
                        <p style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
                          Upload your resume for tailored applications
                        </p>
                      </div>
                      <div style={{ color: 'rgba(212, 175, 108, 0.4)', fontSize: 16, flexShrink: 0 }}>→</div>
                    </motion.div>

                    {/* Quick action chips */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {['"Apply to internships"', '"I have an exam tomorrow"', '"Enter study mode"'].map(chip => (
                        <motion.button
                          key={chip}
                          whileHover={{ scale: 1.04, background: 'rgba(212, 175, 108, 0.1)' }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { setInputText(chip.replace(/"/g, '')); }}
                          style={{
                            background: 'rgba(212, 175, 108, 0.05)',
                            border: `1px solid ${C.borderGold}`,
                            borderRadius: 40, padding: '6px 14px',
                            fontSize: 11.5, color: 'rgba(212, 175, 108, 0.6)',
                            cursor: 'pointer',
                            fontFamily: "'DM Sans', sans-serif",
                            fontStyle: 'italic',
                            transition: 'all 0.2s',
                          }}
                        >
                          {chip}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    width: msg.role === 'agent' ? '100%' : undefined,
                  }}
                >
                  {msg.role === 'agent' ? (
                    /* ── AGENT message: editorial borderless style ── */
                    <div style={{ paddingLeft: 14, position: 'relative' }}>
                      {/* Animated left border */}
                      <motion.div
                        initial={{ scaleY: 0, opacity: 0 }}
                        animate={{ scaleY: 1, opacity: 1 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                          position: 'absolute', left: 0, top: 4, bottom: 4,
                          width: 2,
                          background: `linear-gradient(180deg, rgba(212,175,108,0.7) 0%, rgba(137,206,194,0.4) 100%)`,
                          borderRadius: 2,
                          transformOrigin: 'top',
                        }}
                      />
                      <p style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 7.5, letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: 'rgba(212, 175, 108, 0.4)',
                        marginBottom: 5,
                        fontWeight: 400,
                      }}>MAYA</p>
                      <div style={{
                        fontSize: 11.5, lineHeight: 1.65,
                        color: 'rgba(245, 237, 216, 0.88)',
                        whiteSpace: 'pre-wrap',
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 300,
                      }}>
                        {(msg.source === 'sms' && msg.thoughts?.length) ? (
                          <>
                            {msg.text && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                <span style={{ flex: 1, minWidth: 0 }}>{renderMarkdown(msg.text)}</span>
                                <SmsBadge />
                              </div>
                            )}
                            <ThoughtBox thoughts={msg.thoughts} complete={!!msg.completionText} />
                            {msg.completionText && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 }}>
                                <span style={{ flex: 1, minWidth: 0 }}>{renderMarkdown(msg.completionText)}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {(msg.thoughts && msg.thoughts.length > 0) ? (
                              <ThoughtBox thoughts={msg.thoughts} complete={!!msg.text} />
                            ) : null}
                            {msg.text && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 }}>
                                <span style={{ flex: 1, minWidth: 0 }}>{renderMarkdown(msg.text)}</span>
                                {msg.source === 'sms' && <SmsBadge />}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* ── USER message: iridescent glass pill ── */
                    <div style={{ position: 'relative' }}>
                      {/* Spinning iridescent glow behind the bubble */}
                      <div style={{
                        position: 'absolute', inset: -3, zIndex: 0,
                        borderRadius: '20px 20px 6px 20px',
                        background: 'conic-gradient(from var(--angle, 0deg), #FFD875, #4ECDC4, #C77DFF, #FFD875)',
                        filter: 'blur(8px)',
                        opacity: 0.45,
                        animation: 'spin-hue 4s linear infinite',
                      }} />
                      <motion.div
                        style={{
                          position: 'relative', zIndex: 1,
                          padding: '9px 14px',
                          borderRadius: '18px 18px 4px 18px',
                          background: 'rgba(14, 20, 38, 0.82)',
                          border: '1px solid rgba(212, 175, 108, 0.28)',
                          fontSize: 12.5, lineHeight: 1.6,
                          color: C.textPrimary,
                          backdropFilter: 'blur(20px)',
                          whiteSpace: 'pre-wrap',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 400,
                        }}
                      >
                        {renderMarkdown(msg.text)}
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing indicator — 4-line skeleton shimmer */}
              <AnimatePresence>
                {isAITyping && (
                  <motion.div
                    key="typing"
                    initial={{ opacity: 0, y: 6, filter: 'blur(5px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: 4, filter: 'blur(3px)' }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    style={{ alignSelf: 'flex-start', width: '92%' }}
                  >
                    <div style={{ paddingLeft: 14, position: 'relative' }}>
                      {/* Gradient left border */}
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                          position: 'absolute', left: 0, top: 4, bottom: 4,
                          width: 2,
                          background: 'linear-gradient(180deg, rgba(212,175,108,0.8) 0%, rgba(137,206,194,0.5) 50%, rgba(199,125,255,0.3) 100%)',
                          borderRadius: 2,
                          transformOrigin: 'top',
                        }}
                      />
                      <p style={{ fontSize: 7.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(212, 175, 108, 0.4)', marginBottom: 8, fontWeight: 400, fontFamily: "'JetBrains Mono', monospace" }}>MAYA</p>
                      <SkeletonLines />
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
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                    style={{ alignSelf: 'flex-start', width: '100%', maxWidth: '90%' }}
                  >
                    <p style={{ fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: `rgba(212, 175, 108, 0.45)`, marginBottom: 5, paddingLeft: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>MAYA</p>
                    <div style={{
                      background: C.glass,
                      border: `1px solid ${C.borderGlass}`,
                      borderLeft: `2px solid rgba(212, 175, 108, 0.3)`,
                      borderRadius: '5px 18px 18px 18px',
                      backdropFilter: 'blur(16px)',
                      padding: '14px 16px',
                      display: 'flex', flexDirection: 'column', gap: 12,
                    }}>
                      <pre style={{ margin: 0, fontSize: 12, color: 'rgba(245, 237, 216, 0.8)', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: "'DM Sans', sans-serif" }}>
                        {pendingPlanText}
                      </pre>

                      <div style={{ height: 1, background: C.borderGold }} />

                      <div>
                        <p style={{ fontSize: 11, color: `rgba(212, 175, 108, 0.7)`, marginBottom: 8, fontWeight: 500 }}>Which course are you studying for?</p>
                        <div style={{ display: 'flex', gap: 7 }}>
                          <input
                            autoFocus
                            value={courseInput}
                            onChange={e => setCourseInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && courseInput.trim() && handleSubmitCourse()}
                            placeholder="e.g. CSE 2421, MATH 1151..."
                            style={{
                              flex: 1,
                              background: 'rgba(245, 237, 216, 0.05)',
                              border: `1px solid ${C.borderGold}`,
                              borderRadius: 10, padding: '7px 12px',
                              fontSize: 12, color: C.textPrimary,
                              outline: 'none', fontFamily: "'DM Sans', sans-serif",
                            }}
                          />
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={handleSubmitCourse}
                            disabled={!courseInput.trim()}
                            style={{
                              background: courseInput.trim() ? `linear-gradient(135deg, ${C.accent}, #A87840)` : 'rgba(245, 237, 216, 0.06)',
                              border: 'none', borderRadius: 10, padding: '7px 14px',
                              color: courseInput.trim() ? '#141B2D' : 'rgba(245, 237, 216, 0.25)',
                              fontSize: 12, fontWeight: 600, cursor: courseInput.trim() ? 'pointer' : 'default',
                              transition: 'all 0.2s',
                            }}
                          >Set</motion.button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleStop}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(212, 70, 70, 0.2)',
                            borderRadius: 9, padding: '5px 13px', fontSize: 11,
                            color: 'rgba(212, 112, 112, 0.6)', cursor: 'pointer',
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >Cancel</motion.button>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleConfirmAfterCourse}
                          style={{
                            background: 'rgba(212, 175, 108, 0.12)',
                            border: `1px solid rgba(212, 175, 108, 0.25)`,
                            borderRadius: 9, padding: '5px 14px', fontSize: 11,
                            color: C.accent, cursor: 'pointer', fontWeight: 500,
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >Proceed →</motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Gradient divider ── */}
            <div style={{
              height: 1,
              background: `linear-gradient(90deg, transparent, ${C.borderGold}, transparent)`,
              flexShrink: 0,
            }} />

            {/* ── FLOATING GLASS PILL INPUT ── */}
            <div style={{ position: 'relative', zIndex: 10, padding: '12px 14px 16px', flexShrink: 0, display: isChatCollapsed ? 'none' : 'block' }}>
              <motion.div
                animate={{
                  boxShadow: focused
                    ? `0 0 0 1px rgba(212, 175, 108, 0.3), 0 6px 24px rgba(212,175,108,0.12), 0 2px 8px rgba(0,0,0,0.4)`
                    : `0 2px 12px rgba(0, 0, 0, 0.22)`,
                }}
                style={{
                  display: 'flex', alignItems: 'flex-end', gap: 6,
                  background: 'rgba(18, 25, 44, 0.82)',
                  borderRadius: 28,
                  border: `1px solid ${focused ? 'rgba(212, 175, 108, 0.28)' : 'rgba(212,175,108,0.1)'}`,
                  padding: '8px 8px 8px 16px',
                  backdropFilter: 'blur(28px)',
                  transition: 'border-color 0.25s',
                  position: 'relative', overflow: 'hidden',
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
                  placeholder="Ask Maya anything…"
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: 11.5, color: C.textPrimary,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 300,
                    resize: 'none', overflow: 'hidden',
                    padding: 0, height: inputHeight, maxHeight: 120, lineHeight: 1.55,
                  }}
                />

                {/* Mic button — with red pulse ring when listening */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {isListening && (
                    <motion.div
                      animate={{ scale: [1, 1.9], opacity: [0.7, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'easeOut' }}
                      style={{
                        position: 'absolute', inset: 0,
                        borderRadius: '50%', background: 'rgba(212,80,80,0.6)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={toggleListening}
                    style={{
                      background: isListening ? 'rgba(212, 80, 80, 0.18)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: isListening ? '#E07070' : 'rgba(245, 237, 216, 0.28)',
                      width: 34, height: 34, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Mic size={14} />
                  </motion.button>
                </div>

                {/* Send button */}
                <motion.button
                  whileHover={{ scale: inputText.trim() ? 1.06 : 1 }}
                  whileTap={{ scale: 0.88 }}
                  onClick={send}
                  style={{
                    background: inputText.trim()
                      ? `linear-gradient(135deg, ${C.accent}, #A87840)`
                      : 'rgba(245, 237, 216, 0.06)',
                    border: 'none', cursor: 'pointer',
                    color: inputText.trim() ? C.bg : 'rgba(245, 237, 216, 0.18)',
                    width: 34, height: 34, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: inputText.trim() ? `0 4px 18px rgba(212, 175, 108, 0.38)` : 'none',
                    transition: 'all 0.22s', flexShrink: 0,
                  }}
                >
                  <ArrowUp size={15} />
                </motion.button>
              </motion.div>
            </div>
          </div>
        </motion.div>


        {/* ── RIGHT PANE — browser + study/overlays ── */}
        {!showOnboarding && (
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Study Mode Full Page */}
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
            {/* AgentBrowser — kept mounted to preserve ResizeObserver */}
            <div style={{
              flex: 1, minHeight: 0,
              display: 'flex', flexDirection: 'column',
              visibility: mode === 'study_mode' ? 'hidden' : 'visible',
              position: mode === 'study_mode' ? 'absolute' : 'relative',
              width: '100%', height: '100%',
            }}>
              <AgentBrowser
                navigateRef={browserNavigateRef}
                forceUpdateRef={browserForceUpdateRef}
              />
            </div>
            {/* Career & Notes overlays */}
            <CareerDashboard
              isOpen={isCareerDashboardOpen}
              onClose={() => setIsCareerDashboardOpen(false)}
            />
            <NotesDashboard
              isOpen={isNotesDashboardOpen}
              onClose={() => setIsNotesDashboardOpen(false)}
            />
            <CourseTrackerPage
              isOpen={isCourseTrackerOpen}
              onClose={() => setIsCourseTrackerOpen(false)}
            />
          </div>
        )}

        {/* ── STUDY OVERLAY (study/quiz/results) ── */}
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
                background: `linear-gradient(160deg, #0E1628 0%, #141B2D 40%, #131822 100%)`,
                overflow: 'hidden',
              }}
            >
              {/* Aurora background — muted teal/lavender for study mood */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.14,
              }}>
                <Aurora
                  colorStops={['#89CEC2', '#B48CDC', '#89CEC2']}
                  blend={0.35}
                  amplitude={0.7}
                  speed={0.35}
                />
              </div>
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

    </div >
  );
}

export default App;
