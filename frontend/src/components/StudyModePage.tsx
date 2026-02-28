import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QuizView } from './QuizView';
import {
    BookOpen, ExternalLink, RotateCcw, ShieldOff,
    Sparkles, Loader2, GraduationCap, Library, CheckCircle2,
    Clock, Trash2, ChevronRight, FolderOpen, Save, PlayCircle, Mic,
} from 'lucide-react';
import { useStudySessions, StudySession } from '../hooks/useStudySessions';

// ─── Types ─────────────────────────────────────────────────────────────────
interface AnkiCard { front: string; back: string; }
interface OsuResource { title: string; url: string; tag: string; }
interface NoteSession { id: number; title: string; created_at: string; }

interface StudyModePageProps {
    subject: string;
    blockedCount: number;
    ankiCards: AnkiCard[];
    osuResources: OsuResource[];
    isGeneratingCards: boolean;
    onDisable: () => void;
    onGenerateCards: () => void;
    wsSend: (msg: object) => void;
    studyPlan: { step: number; text: string }[];
}

const C = {
    accent: '#D4AF6C',
    accentBright: '#E8C97E',
    teal: '#89CEC2',
    lavender: '#B48CDC',
    textPrimary: '#F5EDD8',
    textSecond: 'rgba(245, 237, 216, 0.6)',
    textDim: 'rgba(245, 237, 216, 0.35)',
    glass: 'rgba(26, 34, 56, 0.65)',
    glassLight: 'rgba(32, 40, 64, 0.5)',
    borderGold: 'rgba(212, 175, 108, 0.14)',
    borderGlass: 'rgba(245, 237, 216, 0.08)',
    green: '#7DD8B8',
    red: '#D47070',
};

const PAPER_GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)' opacity='0.45'/%3E%3C/svg%3E")`;

// ─── Flip Card ──────────────────────────────────────────────────────────────
function FlipCard({ card, index }: { card: AnkiCard; index: number }) {
    const [flipped, setFlipped] = useState(false);
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, type: 'spring', stiffness: 280, damping: 24 }}
            onClick={() => setFlipped(f => !f)}
            style={{ height: 180, perspective: 1000, cursor: 'pointer' }}
        >
            <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.52, type: 'spring', stiffness: 180, damping: 22 }}
                style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
            >
                {/* Front */}
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: 14,
                    background: '#F4EFE4',
                    backgroundImage: PAPER_GRAIN,
                    backgroundSize: '128px 128px',
                    backgroundBlendMode: 'multiply',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '16px 18px', textAlign: 'center', gap: 10,
                    backfaceVisibility: 'hidden',
                    boxShadow: '0 4px 20px rgba(20, 16, 10, 0.18), 0 2px 6px rgba(20, 16, 10, 0.1), inset 0 1px 0 rgba(255,255,255,0.7)',
                }}>
                    <span style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,20,16,0.35)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>Question</span>
                    <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 14, color: '#1A1410', lineHeight: 1.55, margin: 0 }}>{card.front}</p>
                    <span style={{ fontSize: 9.5, color: 'rgba(26,20,16,0.28)', fontStyle: 'italic', fontFamily: "'DM Sans', sans-serif" }}>tap to reveal</span>
                </div>
                {/* Back */}
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: 14,
                    background: '#EDE7D8',
                    backgroundImage: PAPER_GRAIN,
                    backgroundSize: '128px 128px',
                    backgroundBlendMode: 'multiply',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '16px 18px', textAlign: 'center', gap: 10,
                    backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                    boxShadow: '0 4px 20px rgba(20, 16, 10, 0.18), 0 2px 6px rgba(20, 16, 10, 0.1), inset 0 1px 0 rgba(255,255,255,0.65)',
                }}>
                    <span style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,20,16,0.35)', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>Answer</span>
                    <div style={{ borderLeft: '3px solid rgba(180,130,50,0.5)', paddingLeft: 10 }}>
                        <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 13.5, color: '#3A3228', lineHeight: 1.55, margin: 0 }}>{card.back}</p>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── History Drawer ─────────────────────────────────────────────────────────
function HistoryDrawer({ sessions, onLoad, onDelete, onClose }: {
    sessions: StudySession[];
    onLoad: (s: StudySession) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}) {
    const fmt = (ms: number) => {
        const d = new Date(ms);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    return (
        <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            style={{
                position: 'absolute', top: 0, right: 0, bottom: 0,
                width: 300, zIndex: 30,
                background: 'rgba(16, 22, 38, 0.97)',
                backdropFilter: 'blur(24px)',
                borderLeft: `1px solid ${C.borderGold}`,
                display: 'flex', flexDirection: 'column',
                boxShadow: '-20px 0 60px rgba(0,0,0,0.4)',
            }}
        >
            <div style={{ padding: '20px 18px 14px', borderBottom: `1px solid ${C.borderGlass}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <FolderOpen size={14} style={{ color: C.accent }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, fontFamily: "'DM Sans', sans-serif" }}>Saved Sessions</span>
                </div>
                <button
                    onClick={onClose}
                    style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
                >
                    ×
                </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {sessions.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                        <Clock size={26} style={{ color: C.textDim, marginBottom: 10 }} />
                        <p style={{ margin: 0, fontSize: 12, color: C.textDim, lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif" }}>
                            No saved sessions yet.<br />Sessions auto-save when cards are generated.
                        </p>
                    </div>
                ) : sessions.map(s => (
                    <motion.div
                        key={s.id} layout
                        initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        style={{
                            background: C.glass, border: `1px solid ${C.borderGlass}`,
                            backdropFilter: 'blur(8px)',
                            borderRadius: 12, padding: '11px 13px', marginBottom: 7, cursor: 'pointer',
                            transition: 'background 0.15s',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }} onClick={() => onLoad(s)}>
                                <p style={{ margin: '0 0 3px', fontSize: 12.5, fontWeight: 500, color: C.textPrimary, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {s.subject || 'Untitled Session'}
                                </p>
                                <p style={{ margin: '0 0 6px', fontSize: 10, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(s.savedAt)}</p>
                                <div style={{ display: 'flex', gap: 5 }}>
                                    {s.ankiCards.length > 0 && <span style={{ fontSize: 9.5, background: 'rgba(212,175,108,0.1)', border: `1px solid ${C.borderGold}`, borderRadius: 7, padding: '2px 7px', color: C.accent }}>{s.ankiCards.length} cards</span>}
                                    {s.osuResources.length > 0 && <span style={{ fontSize: 9.5, background: 'rgba(137,206,194,0.08)', border: '1px solid rgba(137,206,194,0.16)', borderRadius: 7, padding: '2px 7px', color: C.teal }}>{s.osuResources.length} links</span>}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 3, flexShrink: 0, marginTop: 2 }}>
                                <button
                                    onClick={() => onLoad(s)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, transition: 'color 0.15s' }}
                                >
                                    <ChevronRight size={13} />
                                </button>
                                <button
                                    onClick={() => onDelete(s.id)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textDim, padding: 4, transition: 'color 0.15s' }}
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

// ─── Session Launcher Card ──────────────────────────────────────────────────
function LauncherCard({ wsSend }: { wsSend: (msg: object) => void }) {
    const [course, setCourse] = useState('');
    const [launching, setLaunching] = useState(false);

    const launch = () => {
        const c = course.trim();
        if (!c) return;
        setLaunching(true);
        wsSend({ type: 'start_study_session', course: c, query: `help me prepare for my upcoming ${c} exam` });
        setTimeout(() => setLaunching(false), 8000);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, type: 'spring', stiffness: 280, damping: 26 }}
            style={{
                background: C.glass,
                backdropFilter: 'blur(16px)',
                border: `1px solid ${C.borderGold}`,
                borderLeft: `3px solid rgba(212, 175, 108, 0.5)`,
                borderRadius: 16, padding: '20px 22px',
                display: 'flex', flexDirection: 'column', gap: 13,
                boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <PlayCircle size={15} style={{ color: C.accent }} />
                <h3 style={{ margin: 0, fontSize: 13.5, fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400, color: C.textPrimary }}>
                    Start a Study Session
                </h3>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: C.textDim, lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif" }}>
                Maya will open Canvas, scrape your lecture slides, generate key concept cards, and produce a 5-question quiz — all automatically.
            </p>

            <div style={{ display: 'flex', gap: 9 }}>
                <input
                    autoFocus
                    value={course}
                    onChange={e => setCourse(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && course.trim() && launch()}
                    placeholder="Course name — e.g. CSE 2421, MATH 1151…"
                    style={{
                        flex: 1,
                        background: 'rgba(20, 27, 45, 0.6)',
                        border: `1px solid ${C.borderGold}`,
                        borderRadius: 10, padding: '8px 13px',
                        fontSize: 12.5, color: C.textPrimary,
                        outline: 'none', fontFamily: "'DM Sans', sans-serif",
                        transition: 'border-color 0.2s',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(212,175,108,0.45)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(212,175,108,0.14)')}
                />
                <motion.button
                    whileHover={{ scale: course.trim() && !launching ? 1.03 : 1 }}
                    whileTap={{ scale: course.trim() && !launching ? 0.97 : 1 }}
                    onClick={launch}
                    disabled={!course.trim() || launching}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        background: course.trim() && !launching
                            ? `linear-gradient(135deg, ${C.accent} 0%, #A87840 100%)`
                            : 'rgba(245, 237, 216, 0.06)',
                        border: 'none', borderRadius: 10, padding: '8px 18px',
                        color: course.trim() && !launching ? '#141B2D' : C.textDim,
                        fontSize: 12.5, fontWeight: 600,
                        cursor: course.trim() && !launching ? 'pointer' : 'default',
                        transition: 'all 0.22s',
                        boxShadow: course.trim() && !launching ? '0 4px 18px rgba(212,175,108,0.3)' : 'none',
                        fontFamily: "'DM Sans', sans-serif",
                    }}
                >
                    {launching
                        ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /><span>Launching…</span></>
                        : <><Sparkles size={12} /><span>Start</span></>
                    }
                </motion.button>
            </div>

            {launching && (
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ margin: 0, fontSize: 11, color: C.accent, opacity: 0.6, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}
                >
                    ✦ Opening Carmen, scraping slides, and generating materials… check the chat for live updates.
                </motion.p>
            )}
        </motion.div>
    );
}

// ─── Notes Study Card ───────────────────────────────────────────────────────
function NotesStudyCard({ noteSessions, selectedNoteId, setSelectedNoteId, isLoading, error, onFlashcards, onQuiz }: {
    noteSessions: NoteSession[];
    selectedNoteId: number | null;
    setSelectedNoteId: (id: number | null) => void;
    isLoading: boolean;
    error: string;
    onFlashcards: () => void;
    onQuiz: () => void;
}) {
    const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, type: 'spring', stiffness: 280, damping: 26 }}
            style={{
                background: C.glass,
                backdropFilter: 'blur(16px)',
                border: `1px solid rgba(180, 140, 220, 0.14)`,
                borderLeft: `3px solid rgba(180, 140, 220, 0.45)`,
                borderRadius: 16, padding: '20px 22px',
                display: 'flex', flexDirection: 'column', gap: 13,
                boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Mic size={15} style={{ color: C.lavender }} />
                <h3 style={{ margin: 0, fontSize: 13.5, fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400, color: C.textPrimary }}>
                    Study from Lecture Notes
                </h3>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: C.textDim, lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif" }}>
                Pick a recorded lecture to generate flashcards or a 5-question quiz from your AI notes — no Canvas needed.
            </p>

            {noteSessions.length === 0 ? (
                <div style={{ padding: '12px 14px', background: 'rgba(180,140,220,0.04)', borderRadius: 10, border: '1px dashed rgba(180,140,220,0.18)', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(180,140,220,0.45)', fontFamily: "'DM Sans', sans-serif" }}>
                        No recorded lectures yet. Use the <strong style={{ color: 'rgba(180,140,220,0.6)' }}>Notes</strong> button in the toolbar to record one first.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {noteSessions.slice(0, 5).map(s => (
                        <motion.div
                            key={s.id}
                            whileHover={{ background: selectedNoteId === s.id ? 'rgba(180,140,220,0.14)' : 'rgba(180,140,220,0.07)' }}
                            onClick={() => setSelectedNoteId(selectedNoteId === s.id ? null : s.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '7px 11px', borderRadius: 9, cursor: 'pointer',
                                background: selectedNoteId === s.id ? 'rgba(180,140,220,0.1)' : 'rgba(180,140,220,0.03)',
                                border: `1px solid ${selectedNoteId === s.id ? 'rgba(180,140,220,0.38)' : 'rgba(180,140,220,0.1)'}`,
                                transition: 'all 0.15s',
                            }}
                        >
                            <BookOpen size={11} style={{ color: 'rgba(180,140,220,0.6)', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 12.5, color: selectedNoteId === s.id ? '#D8C0FF' : C.textSecond, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {s.title.length > 32 ? s.title.slice(0, 32) + '…' : s.title}
                            </span>
                            <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                                {fmtDate(s.created_at)}
                            </span>
                            {selectedNoteId === s.id && (
                                <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.lavender, flexShrink: 0 }} />
                            )}
                        </motion.div>
                    ))}
                </div>
            )}

            {noteSessions.length > 0 && (
                <div style={{ display: 'flex', gap: 9 }}>
                    <motion.button
                        whileHover={{ scale: selectedNoteId && !isLoading ? 1.02 : 1 }}
                        whileTap={{ scale: selectedNoteId && !isLoading ? 0.98 : 1 }}
                        onClick={onFlashcards}
                        disabled={!selectedNoteId || isLoading}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            background: 'transparent',
                            border: `1.5px solid ${selectedNoteId && !isLoading ? 'rgba(180,140,220,0.45)' : 'rgba(180,140,220,0.12)'}`,
                            borderRadius: 10, padding: '8px 14px',
                            color: selectedNoteId && !isLoading ? '#D8C0FF' : 'rgba(180,140,220,0.25)',
                            fontSize: 12.5, fontWeight: 500,
                            cursor: selectedNoteId && !isLoading ? 'pointer' : 'default',
                            transition: 'all 0.2s', fontFamily: "'DM Sans', sans-serif",
                        }}
                    >
                        {isLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <BookOpen size={12} />}
                        <span>Flashcards</span>
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: selectedNoteId && !isLoading ? 1.02 : 1 }}
                        whileTap={{ scale: selectedNoteId && !isLoading ? 0.98 : 1 }}
                        onClick={onQuiz}
                        disabled={!selectedNoteId || isLoading}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            background: selectedNoteId && !isLoading ? 'rgba(180,140,220,0.14)' : 'rgba(180,140,220,0.04)',
                            border: `1.5px solid ${selectedNoteId && !isLoading ? 'rgba(180,140,220,0.4)' : 'rgba(180,140,220,0.1)'}`,
                            borderRadius: 10, padding: '8px 14px',
                            color: selectedNoteId && !isLoading ? '#D8C0FF' : 'rgba(180,140,220,0.25)',
                            fontSize: 12.5, fontWeight: 500,
                            cursor: selectedNoteId && !isLoading ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                            boxShadow: selectedNoteId && !isLoading ? '0 4px 16px rgba(150,100,220,0.2)' : 'none',
                            fontFamily: "'DM Sans', sans-serif",
                        }}
                    >
                        {isLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
                        <span>Take Quiz</span>
                    </motion.button>
                </div>
            )}

            {error && (
                <p style={{ margin: 0, fontSize: 11, color: C.red, opacity: 0.8, fontFamily: "'DM Sans', sans-serif" }}>{error}</p>
            )}
        </motion.div>
    );
}

// ─── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ icon, label, count, badge, action }: {
    icon: React.ReactNode;
    label: string;
    count?: number;
    badge?: string;
    action?: React.ReactNode;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                {icon}
                <h2 style={{
                    margin: 0, fontSize: 14, fontFamily: "'Instrument Serif', serif",
                    fontStyle: 'italic', fontWeight: 400, color: C.textPrimary,
                }}>
                    {label}
                </h2>
                {count !== undefined && count > 0 && (
                    <span style={{ fontSize: 10, background: C.glass, border: `1px solid ${C.borderGold}`, borderRadius: 7, padding: '2px 7px', color: C.accent, fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
                )}
                {badge && (
                    <span style={{ fontSize: 9, background: 'rgba(137,206,194,0.08)', border: '1px solid rgba(137,206,194,0.16)', borderRadius: 7, padding: '2px 8px', color: C.teal, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>{badge}</span>
                )}
            </div>
            {action}
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export function StudyModePage({
    subject, blockedCount, ankiCards, osuResources,
    isGeneratingCards, onDisable, onGenerateCards, wsSend, studyPlan,
}: StudyModePageProps) {
    const { saveSession, listSessions, deleteSession } = useStudySessions();
    const [showHistory, setShowHistory] = useState(false);
    const [sessions, setSessions] = useState<StudySession[]>([]);
    const [savedToast, setSavedToast] = useState(false);
    const [loadedSession, setLoadedSession] = useState<StudySession | null>(null);
    const currentSessionId = useRef<string | undefined>(undefined);

    // ── Lecture notes integration ─────────────────────────────────────────
    const [noteSessions, setNoteSessions] = useState<NoteSession[]>([]);
    const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
    const [noteCards, setNoteCards] = useState<AnkiCard[]>([]);
    const [isLoadingNote, setIsLoadingNote] = useState(false);
    const [noteLoadError, setNoteLoadError] = useState('');
    const [noteQuizData, setNoteQuizData] = useState<{ course_name: string; concepts: any[]; questions: any[] } | null>(null);
    const [noteQuizResult, setNoteQuizResult] = useState<{ score: number; total: number } | null>(null);
    const [lastNoteQuizResult, setLastNoteQuizResult] = useState<{ score: number; total: number; courseName: string } | null>(null);

    useEffect(() => {
        fetch('http://127.0.0.1:8000/lecture-sessions')
            .then(r => r.json())
            .then(setNoteSessions)
            .catch(() => { });
    }, []);

    const handleNoteFlashcards = async () => {
        if (!selectedNoteId) return;
        setIsLoadingNote(true);
        setNoteLoadError('');
        try {
            const res = await fetch(`http://127.0.0.1:8000/lecture-sessions/${selectedNoteId}/flashcards`, { method: 'POST' });
            const data = await res.json();
            setNoteCards(data.cards || []);
        } catch {
            setNoteLoadError('Failed to generate flashcards. Please try again.');
        } finally {
            setIsLoadingNote(false);
        }
    };

    const handleNoteQuiz = async () => {
        if (!selectedNoteId) return;
        setIsLoadingNote(true);
        setNoteLoadError('');
        try {
            const res = await fetch(`http://127.0.0.1:8000/lecture-sessions/${selectedNoteId}/quiz`, { method: 'POST' });
            const data = await res.json();
            setNoteQuizData(data);
        } catch {
            setNoteLoadError('Failed to generate quiz. Please try again.');
        } finally {
            setIsLoadingNote(false);
        }
    };

    useEffect(() => {
        if (ankiCards.length === 0 && osuResources.length === 0) return;
        currentSessionId.current = saveSession(subject, ankiCards, osuResources, currentSessionId.current);
        setSessions(listSessions());
        setSavedToast(true);
        const t = setTimeout(() => setSavedToast(false), 2200);
        return () => clearTimeout(t);
    }, [ankiCards, osuResources]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (showHistory) setSessions(listSessions());
    }, [showHistory, listSessions]);

    const displayCards = loadedSession ? loadedSession.ankiCards : ankiCards;
    const displayResources = loadedSession ? loadedSession.osuResources : osuResources;
    const displaySubject = loadedSession ? loadedSession.subject : subject;

    const navigateToResource = (url: string) => {
        const ipc = (window as any).require?.('electron')?.ipcRenderer;
        if (ipc) { ipc.send('browser-navigate', url); onDisable(); }
        else window.open(url, '_blank');
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{
                flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative',
                overflowY: 'auto',
            }}
        >
            {/* ── Hero Header ────────────────────────────────────────────── */}
            <div style={{
                padding: '28px 36px 22px',
                borderBottom: `1px solid ${C.borderGlass}`,
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                flexShrink: 0,
                background: 'rgba(20, 27, 45, 0.4)',
                backdropFilter: 'blur(8px)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'rgba(212, 175, 108, 0.1)',
                        border: `1.5px solid ${C.borderGold}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <GraduationCap size={18} style={{ color: C.accent }} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <h1 style={{
                                margin: 0, fontSize: 20,
                                fontFamily: "'Instrument Serif', serif",
                                fontStyle: 'italic', fontWeight: 400,
                                color: C.textPrimary, letterSpacing: '-0.02em',
                            }}>
                                Study Mode
                            </h1>
                            {loadedSession && (
                                <span style={{
                                    fontSize: 9, background: 'rgba(137,206,194,0.1)',
                                    border: '1px solid rgba(137,206,194,0.2)',
                                    borderRadius: 8, padding: '2px 8px',
                                    color: C.teal, letterSpacing: '0.08em',
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}>
                                    ARCHIVED
                                </span>
                            )}
                        </div>
                        <p style={{ margin: '3px 0 0', fontSize: 11, color: C.textDim, letterSpacing: '0.04em', fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>
                            {blockedCount} sites blocked{displaySubject ? ` · ${displaySubject}` : ''}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <AnimatePresence>
                        {savedToast && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.green, padding: '4px 10px', background: 'rgba(125,216,184,0.08)', border: '1px solid rgba(125,216,184,0.2)', borderRadius: 9, fontFamily: "'DM Sans', sans-serif" }}
                            >
                                <Save size={11} /><span>Saved</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setShowHistory(v => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: showHistory ? 'rgba(212,175,108,0.1)' : C.glass,
                            backdropFilter: 'blur(8px)',
                            border: `1px solid ${showHistory ? 'rgba(212,175,108,0.3)' : C.borderGlass}`,
                            borderRadius: 18, padding: '5px 12px',
                            color: showHistory ? C.accent : C.textDim,
                            cursor: 'pointer', fontSize: 11.5, fontWeight: 500, transition: 'all 0.2s',
                            fontFamily: "'DM Sans', sans-serif",
                        }}
                    >
                        <FolderOpen size={12} /><span>History</span>
                    </motion.button>

                    {!loadedSession && (
                        <motion.button
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={onGenerateCards} disabled={isGeneratingCards}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: C.glass, backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(137,206,194,0.22)',
                                borderRadius: 18, padding: '5px 12px',
                                color: C.teal, cursor: isGeneratingCards ? 'default' : 'pointer',
                                fontSize: 11.5, fontWeight: 500, opacity: isGeneratingCards ? 0.6 : 1, transition: 'all 0.2s',
                                fontFamily: "'DM Sans', sans-serif",
                            }}
                        >
                            {isGeneratingCards ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
                            <span>{isGeneratingCards ? 'Generating…' : 'Cards from page'}</span>
                        </motion.button>
                    )}

                    {loadedSession ? (
                        <motion.button
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={() => setLoadedSession(null)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: C.glass, backdropFilter: 'blur(8px)',
                                border: `1px solid ${C.borderGlass}`,
                                borderRadius: 18, padding: '5px 12px',
                                color: C.textSecond, cursor: 'pointer', fontSize: 11.5, fontWeight: 500, transition: 'all 0.2s',
                                fontFamily: "'DM Sans', sans-serif",
                            }}
                        >
                            ← Live session
                        </motion.button>
                    ) : (
                        <motion.button
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={onDisable}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: C.glass, backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(212,112,112,0.2)',
                                borderRadius: 18, padding: '5px 12px',
                                color: 'rgba(212,112,112,0.65)', cursor: 'pointer', fontSize: 11.5, fontWeight: 500, transition: 'all 0.2s',
                                fontFamily: "'DM Sans', sans-serif",
                            }}
                        >
                            <ShieldOff size={12} /><span>Exit</span>
                        </motion.button>
                    )}
                </div>
            </div>

            {/* ── Scrollable Body ─────────────────────────────────────────── */}
            <div style={{ flex: 1, padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 32, overflowY: 'auto' }}>

                {/* Launch Card */}
                {!loadedSession && <LauncherCard wsSend={wsSend} />}

                {/* Notes Study Card */}
                {!loadedSession && (
                    <NotesStudyCard
                        noteSessions={noteSessions}
                        selectedNoteId={selectedNoteId}
                        setSelectedNoteId={setSelectedNoteId}
                        isLoading={isLoadingNote}
                        error={noteLoadError}
                        onFlashcards={handleNoteFlashcards}
                        onQuiz={handleNoteQuiz}
                    />
                )}

                {/* Recent Quiz Score */}
                {!loadedSession && lastNoteQuizResult && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            background: C.glass,
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(180,140,220,0.16)',
                            borderRadius: 14, padding: '13px 18px',
                            display: 'flex', alignItems: 'center', gap: 14,
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44, flexShrink: 0 }}>
                            <span style={{
                                fontFamily: "'Instrument Serif', serif",
                                fontStyle: 'italic',
                                fontSize: 26, fontWeight: 400, lineHeight: 1,
                                color: lastNoteQuizResult.score / lastNoteQuizResult.total >= 0.8 ? C.green
                                    : lastNoteQuizResult.score / lastNoteQuizResult.total >= 0.5 ? C.accent : C.red,
                            }}>
                                {lastNoteQuizResult.score}
                            </span>
                            <span style={{ fontSize: 10, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                                / {lastNoteQuizResult.total}
                            </span>
                        </div>
                        <div style={{ width: 1, height: 32, background: 'rgba(180,140,220,0.12)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 2px', fontSize: 9.5, color: C.lavender, opacity: 0.6, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>Recent Quiz Score</p>
                            <p style={{ margin: 0, fontSize: 13, color: '#D8C0FF', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {lastNoteQuizResult.courseName}
                            </p>
                        </div>
                        <div style={{
                            flexShrink: 0, padding: '3px 10px', borderRadius: 18,
                            fontSize: 12, fontWeight: 600,
                            background: lastNoteQuizResult.score / lastNoteQuizResult.total >= 0.8 ? 'rgba(125,216,184,0.1)'
                                : lastNoteQuizResult.score / lastNoteQuizResult.total >= 0.5 ? 'rgba(212,175,108,0.1)' : 'rgba(212,112,112,0.1)',
                            border: `1px solid ${lastNoteQuizResult.score / lastNoteQuizResult.total >= 0.8 ? 'rgba(125,216,184,0.28)'
                                : lastNoteQuizResult.score / lastNoteQuizResult.total >= 0.5 ? 'rgba(212,175,108,0.28)' : 'rgba(212,112,112,0.28)'}`,
                            color: lastNoteQuizResult.score / lastNoteQuizResult.total >= 0.8 ? C.green
                                : lastNoteQuizResult.score / lastNoteQuizResult.total >= 0.5 ? C.accent : C.red,
                            fontFamily: "'JetBrains Mono', monospace",
                        }}>
                            {Math.round(lastNoteQuizResult.score / lastNoteQuizResult.total * 100)}%
                        </div>
                    </motion.div>
                )}

                {/* Flashcards from Lecture Notes */}
                {noteCards.length > 0 && !loadedSession && (
                    <section>
                        <SectionHeader
                            icon={<Mic size={14} style={{ color: C.lavender }} />}
                            label="Flashcards from Lecture Notes"
                            count={noteCards.length}
                        />
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}
                        >
                            {noteCards.map((card, i) => <FlipCard key={i} card={card} index={i} />)}
                        </motion.div>
                    </section>
                )}

                {/* Flashcards */}
                <section>
                    <SectionHeader
                        icon={<BookOpen size={14} style={{ color: C.accent }} />}
                        label="Flashcards"
                        count={displayCards.length}
                        action={displayCards.length > 0 && !loadedSession ? (
                            <motion.button
                                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                                onClick={onGenerateCards}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    background: 'transparent', border: `1px solid ${C.borderGlass}`,
                                    borderRadius: 9, padding: '4px 10px',
                                    color: C.textDim, cursor: 'pointer', fontSize: 11,
                                    fontFamily: "'DM Sans', sans-serif",
                                    transition: 'all 0.15s',
                                }}
                            >
                                <RotateCcw size={10} /><span>Regenerate</span>
                            </motion.button>
                        ) : undefined}
                    />
                    <AnimatePresence mode="wait">
                        {displayCards.length === 0 ? (
                            <motion.div
                                key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{
                                    padding: '24px 20px',
                                    background: C.glass, backdropFilter: 'blur(8px)',
                                    border: `1px dashed ${C.borderGold}`,
                                    borderRadius: 14, textAlign: 'center',
                                }}
                            >
                                <BookOpen size={22} style={{ color: C.textDim, marginBottom: 9 }} />
                                <p style={{ margin: 0, fontSize: 12, color: C.textDim, lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif" }}>
                                    No flashcards yet. Start a session above, or open a lecture slide in the browser and click <strong style={{ color: C.accent }}>Cards from page</strong>.
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}
                            >
                                {displayCards.map((card, i) => <FlipCard key={i} card={card} index={i} />)}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {/* OSU Resources */}
                {displayResources.length > 0 && (
                    <section>
                        <SectionHeader
                            icon={<Library size={14} style={{ color: C.accent }} />}
                            label="OSU Study Resources"
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 9 }}>
                            {displayResources.map((r, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    whileHover={{ background: 'rgba(32, 40, 64, 0.75)' }}
                                    onClick={() => !loadedSession && navigateToResource(r.url)}
                                    style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 11,
                                        background: C.glass, backdropFilter: 'blur(8px)',
                                        border: `1px solid ${C.borderGlass}`,
                                        borderRadius: 12, padding: '12px 14px',
                                        cursor: loadedSession ? 'default' : 'pointer', transition: 'all 0.16s',
                                    }}
                                >
                                    <ExternalLink size={12} style={{ color: C.accent, opacity: 0.5, marginTop: 2, flexShrink: 0 }} />
                                    <div style={{ minWidth: 0 }}>
                                        <p style={{ fontSize: 12.5, color: C.textPrimary, margin: '0 0 3px', lineHeight: 1.4, fontFamily: "'DM Sans', sans-serif" }}>{r.title}</p>
                                        {r.tag && <span style={{ fontSize: 9.5, color: C.accent, opacity: 0.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>{r.tag}</span>}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Study Plan */}
                <section>
                    <SectionHeader
                        icon={<CheckCircle2 size={14} style={{ color: C.accent }} />}
                        label="Study Plan"
                        badge={studyPlan.length > 0 ? 'AI-generated' : undefined}
                    />
                    <div style={{
                        background: C.glass, backdropFilter: 'blur(12px)',
                        border: `1px solid ${C.borderGlass}`,
                        borderRadius: 14, padding: '16px 20px',
                        display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
                        {studyPlan.length > 0 ? (
                            studyPlan.map(item => (
                                <div key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                                    <div style={{
                                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                                        background: 'rgba(137,206,194,0.1)', border: '1px solid rgba(137,206,194,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 9.5, fontWeight: 600, color: C.teal, opacity: 0.8,
                                        fontFamily: "'JetBrains Mono', monospace",
                                    }}>{item.step}</div>
                                    <p style={{ margin: 0, fontSize: 12.5, color: C.textSecond, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{item.text}</p>
                                </div>
                            ))
                        ) : displayCards.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
                                <Loader2 size={12} style={{ color: C.accent, opacity: 0.5, animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: C.textDim, fontFamily: "'DM Sans', sans-serif" }}>Generating personalised study plan from your lecture material…</span>
                            </div>
                        ) : (
                            [
                                { n: '1', text: 'Enter your course name above and click Start — Maya will handle Canvas automatically.' },
                                { n: '2', text: `Navigate to ${displaySubject || 'your course'} on Canvas to scrape the latest lecture slides.` },
                                { n: '3', text: 'Review the flashcards — tap each card to flip front → back.' },
                                { n: '4', text: 'Visit an OSU study resource from the section above.' },
                                { n: '5', text: 'Ask Maya anything in chat — Q&A mode is always available.' },
                            ].map(item => (
                                <div key={item.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                                    <div style={{
                                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                                        background: 'rgba(212,175,108,0.08)', border: `1px solid ${C.borderGold}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 9.5, fontWeight: 600, color: C.accent, opacity: 0.7,
                                        fontFamily: "'JetBrains Mono', monospace",
                                    }}>{item.n}</div>
                                    <p style={{ margin: 0, fontSize: 12.5, color: C.textDim, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{item.text}</p>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <div style={{ height: 32 }} />
            </div>

            {/* ── History Drawer ──────────────────────────────────────────── */}
            <AnimatePresence>
                {showHistory && (
                    <HistoryDrawer
                        sessions={sessions}
                        onLoad={s => { setLoadedSession(s); setShowHistory(false); }}
                        onDelete={id => { deleteSession(id); setSessions(listSessions()); if (loadedSession?.id === id) setLoadedSession(null); }}
                        onClose={() => setShowHistory(false)}
                    />
                )}
            </AnimatePresence>

            {/* ── Inline notes quiz overlay ───────────────────────────────── */}
            <AnimatePresence>
                {noteQuizData && (
                    <motion.div
                        key="note-quiz-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        style={{
                            position: 'absolute', inset: 0, zIndex: 30,
                            background: 'linear-gradient(150deg, #101828 0%, #141B2D 50%, #0E1420 100%)',
                            display: 'flex', flexDirection: 'column',
                        }}
                    >
                        {noteQuizResult ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.94 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={{
                                    flex: 1, display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    padding: '40px 24px', gap: 24,
                                }}
                            >
                                {/* Score ring */}
                                <div style={{ position: 'relative', width: 110, height: 110 }}>
                                    <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
                                        <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(245,237,216,0.06)" strokeWidth="6" />
                                        <circle
                                            cx="55" cy="55" r="46" fill="none"
                                            stroke={noteQuizResult.score / noteQuizResult.total >= 0.8 ? '#7DD8B8'
                                                : noteQuizResult.score / noteQuizResult.total >= 0.5 ? '#D4AF6C' : '#D47070'}
                                            strokeWidth="6"
                                            strokeLinecap="round"
                                            strokeDasharray={`${2 * Math.PI * 46}`}
                                            strokeDashoffset={`${2 * Math.PI * 46 * (1 - noteQuizResult.score / noteQuizResult.total)}`}
                                            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                                        />
                                    </svg>
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 32, fontWeight: 400, color: C.textPrimary, lineHeight: 1 }}>
                                            {noteQuizResult.score}
                                        </span>
                                        <span style={{ fontSize: 11, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                                            / {noteQuizResult.total}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <h2 style={{ margin: 0, fontFamily: "'Instrument Serif', serif", fontSize: 26, fontWeight: 400, color: C.textPrimary, fontStyle: 'italic' }}>
                                        {noteQuizResult.score === noteQuizResult.total ? 'Perfect score!' :
                                            noteQuizResult.score / noteQuizResult.total >= 0.8 ? 'Great work!' :
                                                noteQuizResult.score / noteQuizResult.total >= 0.5 ? 'Good effort!' : 'Keep studying!'}
                                    </h2>
                                    <p style={{ margin: 0, fontSize: 13, color: C.textSecond, lineHeight: 1.65, fontFamily: "'DM Sans', sans-serif" }}>
                                        You got <strong style={{ color: C.textPrimary }}>{noteQuizResult.score} of {noteQuizResult.total}</strong> questions correct
                                        {' '}({Math.round(noteQuizResult.score / noteQuizResult.total * 100)}%).
                                        <br />A personalised study plan is being generated below.
                                    </p>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => { setNoteQuizData(null); setNoteQuizResult(null); }}
                                    style={{
                                        background: `linear-gradient(135deg, ${C.accent} 0%, #A87840 100%)`,
                                        border: 'none', borderRadius: 13, padding: '12px 32px',
                                        color: '#141B2D', fontSize: 14, fontWeight: 600,
                                        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                                        boxShadow: '0 4px 20px rgba(212,175,108,0.3)',
                                    }}
                                >
                                    Back to Study Mode
                                </motion.button>
                            </motion.div>
                        ) : (
                            <QuizView
                                fullScreen
                                data={{
                                    course: noteQuizData.course_name,
                                    concepts: noteQuizData.concepts,
                                    questions: noteQuizData.questions,
                                }}
                                onClose={() => { setNoteQuizData(null); setNoteQuizResult(null); }}
                                onQuizComplete={(score, total, wrongQuestions) => {
                                    wsSend({
                                        type: 'quiz_complete',
                                        score,
                                        total,
                                        wrong_questions: wrongQuestions,
                                        course_name: noteQuizData.course_name,
                                        concepts: noteQuizData.concepts,
                                    });
                                    setNoteQuizResult({ score, total });
                                    setLastNoteQuizResult({ score, total, courseName: noteQuizData.course_name });
                                    handleNoteFlashcards();
                                }}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
