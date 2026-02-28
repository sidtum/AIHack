import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ExternalLink, RotateCcw, ChevronLeft, ChevronRight, ShieldOff, Sparkles, Loader2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface AnkiCard {
    front: string;
    back: string;
}

interface OsuResource {
    title: string;
    url: string;
    tag: string;
}

interface StudyModeOverlayProps {
    blockedCount: number;
    subject: string;
    ankiCards: AnkiCard[];
    osuResources: OsuResource[];
    isGeneratingCards: boolean;
    onDisable: () => void;
    onGenerateCards: () => void;
}

// ─── Flip Card ───────────────────────────────────────────────────────────────
function FlipCard({ card, index }: { card: AnkiCard; index: number }) {
    const [flipped, setFlipped] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setFlipped(f => !f)}
            style={{
                minWidth: 220, height: 140,
                perspective: 800,
                cursor: 'pointer',
                flexShrink: 0,
            }}
        >
            <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    width: '100%', height: '100%',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                }}
            >
                {/* Front */}
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(240,180,60,0.12), rgba(200,140,30,0.06))',
                    border: '1px solid rgba(240,180,60,0.25)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '14px 16px', textAlign: 'center', gap: 8,
                    backfaceVisibility: 'hidden',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}>
                    <span style={{ fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,180,60,0.5)', fontWeight: 500 }}>FRONT</span>
                    <p style={{ fontSize: 12.5, color: '#fff0cc', lineHeight: 1.5, margin: 0 }}>{card.front}</p>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>tap to flip</span>
                </div>

                {/* Back */}
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(80,200,160,0.12), rgba(40,160,130,0.06))',
                    border: '1px solid rgba(80,200,160,0.25)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '14px 16px', textAlign: 'center', gap: 8,
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}>
                    <span style={{ fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(80,200,160,0.5)', fontWeight: 500 }}>BACK</span>
                    <p style={{ fontSize: 12, color: '#ccf0e8', lineHeight: 1.55, margin: 0 }}>{card.back}</p>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function StudyModeOverlay({
    blockedCount,
    subject,
    ankiCards,
    osuResources,
    isGeneratingCards,
    onDisable,
    onGenerateCards,
}: StudyModeOverlayProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollCards = (dir: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({ left: dir === 'right' ? 240 : -240, behavior: 'smooth' });
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        return () => { }; // reserved for future scroll-position tracking
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                pointerEvents: 'auto',
            }}
        >
            {/* ── Block Banner ─────────────────────────────────────────── */}
            <div style={{
                background: 'linear-gradient(90deg, rgba(212,175,108,0.12) 0%, rgba(180,140,80,0.06) 100%)',
                borderBottom: '1px solid rgba(212,175,108,0.14)',
                backdropFilter: 'blur(20px)',
                padding: '8px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
                flexShrink: 0,
            }}>
                <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ color: '#D4AF6C', flexShrink: 0 }}
                >
                    <BookOpen size={14} />
                </motion.div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#D4AF6C', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace" }}>
                        STUDY MODE
                    </span>
                    <span style={{ fontSize: 11, color: 'rgba(245,237,216,0.45)', marginLeft: 8, fontFamily: "'DM Sans', sans-serif" }}>
                        {blockedCount} distracting sites blocked
                        {subject ? ` · ${subject}` : ''}
                    </span>
                </div>

                {/* Generate cards button */}
                <motion.button
                    whileHover={{ scale: 1.03, background: 'rgba(80,200,160,0.18)' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onGenerateCards}
                    disabled={isGeneratingCards}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'rgba(137,206,194,0.08)',
                        border: '1px solid rgba(137,206,194,0.2)',
                        borderRadius: 16, padding: '4px 12px',
                        color: '#89CEC2', cursor: isGeneratingCards ? 'default' : 'pointer',
                        fontSize: 11, fontWeight: 500,
                        opacity: isGeneratingCards ? 0.6 : 1,
                        transition: 'all 0.2s',
                    }}
                >
                    {isGeneratingCards
                        ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Sparkles size={11} />}
                    <span>{isGeneratingCards ? 'Generating...' : 'Generate cards from page'}</span>
                </motion.button>

                {/* Disable button */}
                <motion.button
                    whileHover={{ scale: 1.05, color: '#ff8080' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onDisable}
                    title="Exit Study Mode"
                    style={{
                        background: 'transparent', border: 'none',
                        cursor: 'pointer', color: 'rgba(255,200,150,0.4)',
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 11, transition: 'color 0.2s', flexShrink: 0,
                        padding: '4px 6px', borderRadius: 8,
                    }}
                >
                    <ShieldOff size={12} />
                    <span>Exit</span>
                </motion.button>
            </div>

            {/* ── Anki Cards Carousel ───────────────────────────────────── */}
            <AnimatePresence>
                {ankiCards.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            background: 'rgba(0,0,0,0.25)',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            backdropFilter: 'blur(16px)',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ padding: '10px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,240,180,0.35)', fontWeight: 500 }}>
                                📇 Anki cards — {ankiCards.length} generated
                            </span>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                    onClick={() => scrollCards('left')}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,240,180,0.3)', padding: 2 }}
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <button
                                    onClick={() => scrollCards('right')}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,240,180,0.3)', padding: 2 }}
                                >
                                    <ChevronRight size={14} />
                                </button>
                                <button
                                    onClick={onGenerateCards}
                                    title="Regenerate"
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,240,180,0.3)', padding: 2 }}
                                >
                                    <RotateCcw size={11} />
                                </button>
                            </div>
                        </div>

                        <div
                            ref={scrollRef}
                            style={{
                                display: 'flex', gap: 10, padding: '4px 16px 12px',
                                overflowX: 'auto', overflowY: 'visible',
                                scrollbarWidth: 'none',
                            }}
                            // @ts-ignore
                            onMouseDown={(e) => { e.currentTarget.style.cursor = 'grabbing'; }}
                            onMouseUp={(e) => { e.currentTarget.style.cursor = 'grab'; }}
                        >
                            {ankiCards.map((card, i) => (
                                <FlipCard key={i} card={card} index={i} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── OSU Study Resources ──────────────────────────────────── */}
            <AnimatePresence>
                {osuResources.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        style={{
                            background: 'rgba(0,0,0,0.18)',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            backdropFilter: 'blur(16px)',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ padding: '8px 16px 4px' }}>
                            <span style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,240,180,0.35)', fontWeight: 500 }}>
                                🔗 OSU Study Resources
                            </span>
                        </div>
                        <div style={{
                            display: 'flex', gap: 6, padding: '4px 16px 10px',
                            overflowX: 'auto', scrollbarWidth: 'none', flexWrap: 'nowrap',
                        }}>
                            {osuResources.map((r, i) => (
                                <motion.a
                                    key={i}
                                    href={r.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.08)' }}
                                    onClick={(e) => {
                                        // In Electron, open in embedded browser view via IPC
                                        const ipc = (window as any).require?.('electron')?.ipcRenderer;
                                        if (ipc) {
                                            e.preventDefault();
                                            ipc.send('browser-navigate', r.url);
                                        }
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 10, padding: '5px 10px',
                                        textDecoration: 'none', flexShrink: 0,
                                        transition: 'all 0.2s',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <ExternalLink size={10} style={{ color: 'rgba(240,180,60,0.5)', flexShrink: 0 }} />
                                    <div>
                                        <p style={{ fontSize: 11, color: '#e8e0cc', margin: 0, lineHeight: 1.3, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {r.title}
                                        </p>
                                        {r.tag && (
                                            <span style={{ fontSize: 9, color: 'rgba(240,180,60,0.45)', letterSpacing: '0.08em' }}>{r.tag}</span>
                                        )}
                                    </div>
                                </motion.a>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
