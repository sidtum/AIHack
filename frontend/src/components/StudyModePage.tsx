import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, ExternalLink, RotateCcw, ShieldOff,
    Sparkles, Loader2, GraduationCap, Library, CheckCircle2,
    Clock, Trash2, ChevronRight, FolderOpen, Save, PlayCircle,
} from 'lucide-react';
import { useStudySessions, StudySession } from '../hooks/useStudySessions';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnkiCard { front: string; back: string; }
interface OsuResource { title: string; url: string; tag: string; }

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

// ─── Flip Card ────────────────────────────────────────────────────────────────
function FlipCard({ card, index }: { card: AnkiCard; index: number }) {
    const [flipped, setFlipped] = useState(false);
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 280, damping: 24 }}
            onClick={() => setFlipped(f => !f)}
            style={{ height: 180, perspective: 900, cursor: 'pointer' }}
        >
            <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
                style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
            >
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: 18,
                    background: 'linear-gradient(135deg, rgba(240,180,60,0.14), rgba(200,140,30,0.07))',
                    border: '1px solid rgba(240,180,60,0.28)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '18px 20px', textAlign: 'center', gap: 10,
                    backfaceVisibility: 'hidden', boxShadow: '0 6px 30px rgba(0,0,0,0.35)',
                }}>
                    <span style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(240,180,60,0.5)', fontWeight: 600 }}>QUESTION</span>
                    <p style={{ fontSize: 13.5, color: '#fff0cc', lineHeight: 1.55, margin: 0 }}>{card.front}</p>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic', marginTop: 4 }}>tap to reveal</span>
                </div>
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: 18,
                    background: 'linear-gradient(135deg, rgba(80,200,160,0.14), rgba(40,160,130,0.07))',
                    border: '1px solid rgba(80,200,160,0.28)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '18px 20px', textAlign: 'center', gap: 10,
                    backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                    boxShadow: '0 6px 30px rgba(0,0,0,0.35)',
                }}>
                    <span style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(80,200,160,0.5)', fontWeight: 600 }}>ANSWER</span>
                    <p style={{ fontSize: 13, color: '#ccf0e8', lineHeight: 1.6, margin: 0 }}>{card.back}</p>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── History Drawer ───────────────────────────────────────────────────────────
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
                width: 320, zIndex: 30,
                background: 'linear-gradient(160deg, #0e1e1a, #0c1620)',
                borderLeft: '1px solid rgba(240,180,60,0.18)',
                display: 'flex', flexDirection: 'column',
                boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
            }}
        >
            <div style={{ padding: '22px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <FolderOpen size={15} style={{ color: 'rgba(240,180,60,0.7)' }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,240,180,0.85)' }}>Saved Sessions</span>
                </div>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</motion.button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
                {sessions.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                        <Clock size={28} style={{ color: 'rgba(255,240,180,0.15)', marginBottom: 12 }} />
                        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,240,180,0.3)', lineHeight: 1.6 }}>
                            No saved sessions yet.<br />Sessions auto-save when cards are generated.
                        </p>
                    </div>
                ) : sessions.map(s => (
                    <motion.div key={s.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }} whileHover={{ background: 'rgba(255,255,255,0.055)' }}
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', transition: 'background 0.15s' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }} onClick={() => onLoad(s)}>
                                <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 600, color: '#e8d8a8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {s.subject || 'Untitled Session'}
                                </p>
                                <p style={{ margin: '0 0 6px', fontSize: 10, color: 'rgba(255,240,180,0.35)' }}>{fmt(s.savedAt)}</p>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {s.ankiCards.length > 0 && <span style={{ fontSize: 9.5, background: 'rgba(240,180,60,0.12)', border: '1px solid rgba(240,180,60,0.18)', borderRadius: 8, padding: '2px 7px', color: 'rgba(240,180,60,0.65)' }}>{s.ankiCards.length} cards</span>}
                                    {s.osuResources.length > 0 && <span style={{ fontSize: 9.5, background: 'rgba(80,200,160,0.1)', border: '1px solid rgba(80,200,160,0.18)', borderRadius: 8, padding: '2px 7px', color: 'rgba(80,200,160,0.65)' }}>{s.osuResources.length} links</span>}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginTop: 2 }}>
                                <motion.button whileHover={{ scale: 1.1, color: '#6ee7c8' }} whileTap={{ scale: 0.9 }} onClick={() => onLoad(s)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', padding: 4 }} title="Open">
                                    <ChevronRight size={14} />
                                </motion.button>
                                <motion.button whileHover={{ scale: 1.1, color: '#ff8080' }} whileTap={{ scale: 0.9 }} onClick={() => onDelete(s.id)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', padding: 4 }} title="Delete">
                                    <Trash2 size={13} />
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

// ─── Session Launcher Card ────────────────────────────────────────────────────
function LauncherCard({ wsSend }: { wsSend: (msg: object) => void }) {
    const [course, setCourse] = useState('');
    const [launching, setLaunching] = useState(false);

    const launch = () => {
        const c = course.trim();
        if (!c) return;
        setLaunching(true);
        wsSend({ type: 'start_study_session', course: c, query: `help me prepare for my upcoming ${c} exam` });
        // Reset after a moment (backend will drive progress via WS messages)
        setTimeout(() => setLaunching(false), 8000);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 26 }}
            style={{
                background: 'linear-gradient(135deg, rgba(240,180,60,0.1), rgba(200,140,30,0.05))',
                border: '1.5px solid rgba(240,180,60,0.25)',
                borderRadius: 20, padding: '22px 26px',
                display: 'flex', flexDirection: 'column', gap: 14,
                boxShadow: '0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(240,180,60,0.1)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PlayCircle size={17} style={{ color: 'rgba(240,180,60,0.8)' }} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#ffe8b0', letterSpacing: '0.02em' }}>
                    Start a Study Session
                </h3>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,240,180,0.45)', lineHeight: 1.6 }}>
                Sayam will open Canvas, scrape your lecture slides, generate key concept cards, and produce a 5-question quiz — all automatically.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
                <input
                    autoFocus
                    value={course}
                    onChange={e => setCourse(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && course.trim() && launch()}
                    placeholder="Course name — e.g. CSE 2421, MATH 1151..."
                    style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(240,180,60,0.2)',
                        borderRadius: 12, padding: '9px 14px',
                        fontSize: 12.5, color: '#f0e8d0',
                        outline: 'none', fontFamily: "'DM Sans', sans-serif",
                        transition: 'border-color 0.2s',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(240,180,60,0.5)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(240,180,60,0.2)')}
                />
                <motion.button
                    whileHover={{ scale: course.trim() && !launching ? 1.04 : 1 }}
                    whileTap={{ scale: course.trim() && !launching ? 0.96 : 1 }}
                    onClick={launch}
                    disabled={!course.trim() || launching}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: course.trim() && !launching
                            ? 'linear-gradient(135deg, #d4a030, #9a7015)'
                            : 'rgba(255,255,255,0.07)',
                        border: 'none', borderRadius: 12, padding: '9px 20px',
                        color: course.trim() && !launching ? '#fff8e0' : 'rgba(255,240,180,0.25)',
                        fontSize: 12.5, fontWeight: 600, cursor: course.trim() && !launching ? 'pointer' : 'default',
                        transition: 'all 0.22s',
                        boxShadow: course.trim() && !launching ? '0 4px 20px rgba(200,140,20,0.35)' : 'none',
                    }}
                >
                    {launching
                        ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /><span>Launching...</span></>
                        : <><Sparkles size={13} /><span>Start</span></>
                    }
                </motion.button>
            </div>

            {launching && (
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ margin: 0, fontSize: 11, color: 'rgba(240,180,60,0.55)', lineHeight: 1.5 }}
                >
                    ✦ Opening Carmen, scraping slides, and generating materials... check the chat for live updates.
                </motion.p>
            )}
        </motion.div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
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
                background: 'radial-gradient(ellipse at 60% 0%, rgba(240,180,60,0.07) 0%, transparent 60%), rgba(6,14,12,0.97)',
                overflowY: 'auto',
            }}
        >
            {/* ── Hero Header ─────────────────────────────────────────────────── */}
            <div style={{ padding: '32px 44px 24px', borderBottom: '1px solid rgba(240,180,60,0.15)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2.8, repeat: Infinity }}
                        style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg, rgba(240,180,60,0.22), rgba(200,140,30,0.1))', border: '1.5px solid rgba(240,180,60,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(240,180,60,0.12)' }}>
                        <GraduationCap size={21} style={{ color: '#f0c050' }} />
                    </motion.div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', color: '#ffe8b0', fontFamily: "'Instrument Serif', serif" }}>Study Mode</h1>
                            {loadedSession && <span style={{ fontSize: 10, background: 'rgba(80,160,240,0.15)', border: '1px solid rgba(80,160,240,0.25)', borderRadius: 10, padding: '2px 8px', color: 'rgba(120,180,255,0.7)', letterSpacing: '0.06em' }}>ARCHIVED</span>}
                        </div>
                        <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'rgba(255,240,180,0.4)', letterSpacing: '0.04em' }}>
                            {blockedCount} sites blocked{displaySubject ? ` · ${displaySubject}` : ''}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <AnimatePresence>
                        {savedToast && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(80,200,140,0.8)', padding: '5px 10px', background: 'rgba(80,200,140,0.1)', border: '1px solid rgba(80,200,140,0.2)', borderRadius: 10 }}>
                                <Save size={11} /><span>Saved</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.button whileHover={{ scale: 1.03, background: 'rgba(240,180,60,0.15)' }} whileTap={{ scale: 0.97 }}
                        onClick={() => setShowHistory(v => !v)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: showHistory ? 'rgba(240,180,60,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showHistory ? 'rgba(240,180,60,0.35)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 20, padding: '6px 14px', color: showHistory ? '#f0c050' : 'rgba(255,240,180,0.55)', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.2s' }}>
                        <FolderOpen size={13} /><span>History</span>
                    </motion.button>

                    {!loadedSession && (
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onGenerateCards} disabled={isGeneratingCards}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(80,200,160,0.12)', border: '1px solid rgba(80,200,160,0.28)', borderRadius: 20, padding: '6px 14px', color: '#6ee7c8', cursor: isGeneratingCards ? 'default' : 'pointer', fontSize: 12, fontWeight: 500, opacity: isGeneratingCards ? 0.6 : 1, transition: 'all 0.2s' }}>
                            {isGeneratingCards ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
                            <span>{isGeneratingCards ? 'Generating...' : 'Cards from page'}</span>
                        </motion.button>
                    )}

                    {loadedSession ? (
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setLoadedSession(null)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '6px 14px', color: 'rgba(255,240,180,0.6)', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.2s' }}>
                            ← Live session
                        </motion.button>
                    ) : (
                        <motion.button whileHover={{ scale: 1.04, background: 'rgba(255,80,80,0.15)', color: '#ff8080' }} whileTap={{ scale: 0.96 }} onClick={onDisable}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 20, padding: '6px 14px', color: 'rgba(255,150,140,0.65)', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all 0.2s' }}>
                            <ShieldOff size={13} /><span>Exit</span>
                        </motion.button>
                    )}
                </div>
            </div>

            {/* ── Scrollable Body ──────────────────────────────────────────── */}
            <div style={{ flex: 1, padding: '28px 44px', display: 'flex', flexDirection: 'column', gap: 36, overflowY: 'auto' }}>

                {/* ── Launch Card (only in live, non-loaded mode) ──────────── */}
                {!loadedSession && <LauncherCard wsSend={wsSend} />}

                {/* ── Flashcards ──────────────────────────────────────────── */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <BookOpen size={15} style={{ color: 'rgba(240,180,60,0.7)' }} />
                            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'rgba(255,240,180,0.8)', letterSpacing: '0.04em' }}>Flashcards</h2>
                            {displayCards.length > 0 && <span style={{ fontSize: 11, background: 'rgba(240,180,60,0.13)', border: '1px solid rgba(240,180,60,0.2)', borderRadius: 10, padding: '2px 8px', color: 'rgba(240,180,60,0.65)' }}>{displayCards.length}</span>}
                        </div>
                        {displayCards.length > 0 && !loadedSession && (
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onGenerateCards}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid rgba(255,240,180,0.1)', borderRadius: 10, padding: '4px 10px', color: 'rgba(255,240,180,0.3)', cursor: 'pointer', fontSize: 11 }}>
                                <RotateCcw size={11} /><span>Regenerate</span>
                            </motion.button>
                        )}
                    </div>
                    <AnimatePresence mode="wait">
                        {displayCards.length === 0 ? (
                            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ padding: '26px 22px', background: 'rgba(255,255,255,0.025)', border: '1px dashed rgba(255,240,180,0.1)', borderRadius: 16, textAlign: 'center' }}>
                                <BookOpen size={24} style={{ color: 'rgba(240,180,60,0.2)', marginBottom: 10 }} />
                                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,240,180,0.28)', lineHeight: 1.65 }}>
                                    No flashcards yet. Start a session above, or open a lecture slide in the browser and click <strong style={{ color: 'rgba(240,180,60,0.45)' }}>Cards from page</strong>.
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                                {displayCards.map((card, i) => <FlipCard key={i} card={card} index={i} />)}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>

                {/* ── OSU Resources ────────────────────────────────────────── */}
                {displayResources.length > 0 && (
                    <section>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <Library size={15} style={{ color: 'rgba(240,180,60,0.7)' }} />
                            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'rgba(255,240,180,0.8)', letterSpacing: '0.04em' }}>OSU Study Resources</h2>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 11 }}>
                            {displayResources.map((r, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                                    whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.07)' }}
                                    onClick={() => !loadedSession && navigateToResource(r.url)}
                                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '13px 15px', cursor: loadedSession ? 'default' : 'pointer', transition: 'all 0.18s' }}>
                                    <ExternalLink size={13} style={{ color: 'rgba(240,180,60,0.47)', marginTop: 2, flexShrink: 0 }} />
                                    <div style={{ minWidth: 0 }}>
                                        <p style={{ fontSize: 12.5, color: '#e8e0cc', margin: '0 0 3px', lineHeight: 1.4, fontWeight: 500 }}>{r.title}</p>
                                        {r.tag && <span style={{ fontSize: 10, color: 'rgba(240,180,60,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{r.tag}</span>}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Study Plan ───────────────────────────────────────────── */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <CheckCircle2 size={15} style={{ color: 'rgba(240,180,60,0.7)' }} />
                        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'rgba(255,240,180,0.8)', letterSpacing: '0.04em' }}>Study Plan</h2>
                        {studyPlan.length > 0 && (
                            <span style={{ fontSize: 9.5, background: 'rgba(80,200,160,0.1)', border: '1px solid rgba(80,200,160,0.2)', borderRadius: 8, padding: '2px 7px', color: 'rgba(80,200,160,0.65)' }}>AI-generated</span>
                        )}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                        {studyPlan.length > 0 ? (
                            studyPlan.map(item => (
                                <div key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: 'rgba(80,200,160,0.12)', border: '1px solid rgba(80,200,160,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(80,200,160,0.7)' }}>{item.step}</div>
                                    <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,240,180,0.6)', lineHeight: 1.6 }}>{item.text}</p>
                                </div>
                            ))
                        ) : displayCards.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                                <Loader2 size={13} style={{ color: 'rgba(240,180,60,0.4)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: 'rgba(255,240,180,0.3)' }}>Generating personalised study plan from your lecture material...</span>
                            </div>
                        ) : (
                            [
                                { n: '1', text: 'Enter your course name above and click Start — Sayam will handle Canvas automatically.' },
                                { n: '2', text: `Navigate to ${displaySubject || 'your course'} on Canvas to scrape the latest lecture slides.` },
                                { n: '3', text: 'Review the flashcards — tap each card to flip front → back.' },
                                { n: '4', text: 'Visit an OSU study resource from the section above.' },
                                { n: '5', text: 'Ask Sayam anything in chat — Q&A mode is always available.' },
                            ].map(item => (
                                <div key={item.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, background: 'rgba(240,180,60,0.1)', border: '1px solid rgba(240,180,60,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'rgba(240,180,60,0.6)' }}>{item.n}</div>
                                    <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,240,180,0.5)', lineHeight: 1.6 }}>{item.text}</p>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <div style={{ height: 32 }} />
            </div>

            {/* ── History Drawer ───────────────────────────────────────────── */}
            <AnimatePresence>
                {showHistory && (
                    <HistoryDrawer sessions={sessions} onLoad={s => { setLoadedSession(s); setShowHistory(false); }}
                        onDelete={id => { deleteSession(id); setSessions(listSessions()); if (loadedSession?.id === id) setLoadedSession(null); }}
                        onClose={() => setShowHistory(false)} />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
