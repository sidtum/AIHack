import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowUp, BookOpen, MessageCircle, ChevronLeft, ChevronRight, Play } from 'lucide-react';

const C = {
  accent: '#D4AF6C',
  accentBright: '#E8C97E',
  teal: '#89CEC2',
  textPrimary: '#F5EDD8',
  textSecond: 'rgba(245, 237, 216, 0.65)',
  textDim: 'rgba(245, 237, 216, 0.35)',
  glass: 'rgba(26, 34, 56, 0.65)',
  borderGold: 'rgba(212, 175, 108, 0.14)',
  borderGlass: 'rgba(245, 237, 216, 0.08)',
};

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '3px 0' }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          style={{ width: 4, height: 4, borderRadius: '50%', background: C.accent }}
        />
      ))}
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith('**') && seg.endsWith('**'))
      return <strong key={i} style={{ fontWeight: 600 }}>{seg.slice(2, -2)}</strong>;
    if (seg.startsWith('*') && seg.endsWith('*'))
      return <em key={i} style={{ fontStyle: 'italic', color: C.accentBright }}>{seg.slice(1, -1)}</em>;
    return seg;
  });
}

interface Concept {
  title: string;
  explanation: string;
  key_points: string[];
}

interface StudyPanelProps {
  courseName: string;
  concepts: Concept[];
  qaMessages: { role: 'user' | 'agent'; text: string }[];
  onStartQuiz: () => void;
  onBack: () => void;
  onSendQA: (question: string) => void;
  fullScreen?: boolean;
}

export function StudyPanel({ courseName, concepts, qaMessages, onStartQuiz, onBack, onSendQA, fullScreen }: StudyPanelProps) {
  const [tab, setTab] = useState<'concepts' | 'qa'>('concepts');
  const [conceptIndex, setConceptIndex] = useState(0);
  const [qaInput, setQaInput] = useState('');
  const [isQATyping, setIsQATyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [qaMessages, isQATyping]);

  useEffect(() => {
    if (qaMessages.length > 0 && qaMessages[qaMessages.length - 1].role === 'agent') {
      setIsQATyping(false);
    }
  }, [qaMessages]);

  const sendQA = () => {
    if (!qaInput.trim()) return;
    onSendQA(qaInput);
    setQaInput('');
    setIsQATyping(true);
  };

  const handleGotIt = () => {
    if (conceptIndex < concepts.length - 1) {
      setConceptIndex(i => i + 1);
    } else {
      setTab('qa');
      setTimeout(() => qaInputRef.current?.focus(), 120);
    }
  };

  const concept = concepts[conceptIndex];

  // ── Tab bar component ─────────────────────────────────────────────────
  const TabBar = () => (
    <div style={{ display: 'flex', gap: 3, background: 'rgba(245, 237, 216, 0.04)', borderRadius: 10, padding: 3 }}>
      {[
        { key: 'concepts' as const, icon: BookOpen, label: 'Concepts' },
        { key: 'qa' as const, icon: MessageCircle, label: 'Q&A' },
      ].map(({ key, icon: Icon, label }) => (
        <button key={key} onClick={() => setTab(key)} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 14px', borderRadius: 8,
          background: tab === key ? 'rgba(212, 175, 108, 0.12)' : 'transparent',
          border: tab === key ? `1px solid rgba(212, 175, 108, 0.22)` : '1px solid transparent',
          color: tab === key ? C.accent : C.textDim,
          fontSize: 12, cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: tab === key ? 500 : 400,
          transition: 'all 0.2s',
        }}>
          <Icon size={12} />
          {label}
        </button>
      ))}
    </div>
  );

  // ── Full-screen layout ───────────────────────────────────────────────
  if (fullScreen) {
    return (
      <div style={{
        position: 'relative', zIndex: 5,
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', alignItems: 'center',
      }}>
        {/* Header */}
        <div style={{
          width: '100%', maxWidth: 700,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '20px 24px', flexShrink: 0,
          borderBottom: `1px solid ${C.borderGold}`,
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'rgba(245, 237, 216, 0.35)', display: 'flex',
              width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(245, 237, 216, 0.7)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(245, 237, 216, 0.35)'}
          >
            <ArrowLeft size={17} />
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontSize: 22, color: C.textPrimary, fontWeight: 400, margin: 0,
              letterSpacing: '-0.02em',
            }}>
              {courseName}
            </h2>
            <span style={{
              fontSize: 10, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: C.textDim,
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
            }}>
              Study Session
            </span>
          </div>
          <TabBar />
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: 'auto',
          width: '100%', maxWidth: 700,
          padding: '32px 24px',
        }}>
          <AnimatePresence mode="wait">
            {tab === 'concepts' ? (
              <motion.div
                key="concepts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                {/* Counter */}
                <div style={{
                  fontSize: 10.5, letterSpacing: '0.18em',
                  textTransform: 'uppercase', color: C.textDim,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 300,
                  marginBottom: 24, textAlign: 'center',
                }}>
                  Concept {conceptIndex + 1} of {concepts.length}
                </div>

                {/* Concept card */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={conceptIndex}
                    initial={{ opacity: 0, x: 28 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -28 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    style={{
                      width: '100%',
                      background: C.glass,
                      border: `1px solid ${C.borderGlass}`,
                      borderLeft: `3px solid rgba(212, 175, 108, 0.4)`,
                      borderRadius: 18,
                      padding: '28px 30px',
                      backdropFilter: 'blur(16px)',
                      marginBottom: 28,
                      boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
                    }}
                  >
                    <h3 style={{
                      fontFamily: "'Instrument Serif', serif",
                      fontStyle: 'italic',
                      fontSize: 24, color: C.textPrimary, fontWeight: 400,
                      margin: '0 0 14px',
                      letterSpacing: '-0.02em',
                    }}>
                      {concept?.title}
                    </h3>
                    <p style={{
                      fontSize: 14.5, color: C.textSecond,
                      lineHeight: 1.78, margin: '0 0 18px',
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 300,
                    }}>
                      {concept?.explanation}
                    </p>
                    {concept?.key_points && concept.key_points.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingLeft: 4 }}>
                        {concept.key_points.map((pt, j) => (
                          <div key={j} style={{
                            fontSize: 13, color: 'rgba(245, 237, 216, 0.5)',
                            display: 'flex', gap: 10, lineHeight: 1.6,
                            fontFamily: "'DM Sans', sans-serif",
                          }}>
                            <span style={{ color: C.accent, flexShrink: 0, opacity: 0.7 }}>·</span>
                            {pt}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 20 }}>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setConceptIndex(i => i - 1)}
                    disabled={conceptIndex === 0}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: conceptIndex === 0 ? 'transparent' : 'rgba(245, 237, 216, 0.05)',
                      border: `1px solid ${C.borderGlass}`,
                      borderRadius: 11, padding: '10px 18px',
                      color: conceptIndex === 0 ? 'rgba(245, 237, 216, 0.18)' : C.textSecond,
                      fontSize: 13, cursor: conceptIndex === 0 ? 'default' : 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
                      transition: 'all 0.18s',
                    }}
                  >
                    <ChevronLeft size={15} /> Prev
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleGotIt}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'rgba(212, 175, 108, 0.1)',
                      border: `1px solid rgba(212, 175, 108, 0.25)`,
                      borderRadius: 11, padding: '10px 20px',
                      color: C.accent, fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 500,
                      transition: 'all 0.18s',
                    }}
                  >
                    {conceptIndex === concepts.length - 1 ? 'Got it ✓' : <>Got it <ChevronRight size={15} /></>}
                  </motion.button>
                </div>

                {/* Start Quiz */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onStartQuiz}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: `linear-gradient(135deg, ${C.accent} 0%, #A87840 100%)`,
                    border: 'none', borderRadius: 14, padding: '14px 24px',
                    color: '#141B2D', fontSize: 15, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    boxShadow: `0 4px 22px rgba(212, 175, 108, 0.28)`,
                    letterSpacing: '0.02em',
                  }}
                >
                  <Play size={16} /> Start Quiz
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="qa"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}
              >
                {/* QA Messages */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200 }}>
                  {qaMessages.length === 0 && !isQATyping && (
                    <div style={{
                      textAlign: 'center', padding: '48px 20px',
                      color: C.textDim, fontSize: 13,
                      fontFamily: "'DM Sans', sans-serif",
                      fontStyle: 'italic',
                    }}>
                      Ask questions about the course material.
                    </div>
                  )}
                  {qaMessages.map((msg, i) => (
                    <div key={i} style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      padding: '10px 15px',
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                      background: msg.role === 'user'
                        ? 'rgba(212, 175, 108, 0.12)'
                        : C.glass,
                      border: msg.role === 'user'
                        ? `1px solid rgba(212, 175, 108, 0.22)`
                        : `1px solid ${C.borderGlass}`,
                      borderLeft: msg.role === 'agent' ? `2px solid rgba(212, 175, 108, 0.3)` : undefined,
                      fontSize: 13.5, lineHeight: 1.7,
                      color: msg.role === 'user' ? C.textPrimary : C.textSecond,
                      backdropFilter: 'blur(12px)',
                      whiteSpace: 'pre-wrap',
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {renderMarkdown(msg.text)}
                    </div>
                  ))}
                  <AnimatePresence>
                    {isQATyping && (
                      <motion.div
                        key="qa-typing"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        style={{ alignSelf: 'flex-start', maxWidth: '85%' }}
                      >
                        <p style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase',
                          color: `rgba(212, 175, 108, 0.45)`,
                          marginBottom: 5, paddingLeft: 14, fontWeight: 500,
                        }}>MAYA</p>
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: '4px 16px 16px 16px',
                          background: C.glass,
                          border: `1px solid ${C.borderGlass}`,
                          borderLeft: `2px solid rgba(212, 175, 108, 0.3)`,
                          backdropFilter: 'blur(12px)',
                        }}>
                          <TypingDots />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div ref={bottomRef} />
                </div>

                {/* QA Input */}
                <div style={{
                  display: 'flex', gap: 6,
                  background: 'rgba(26, 34, 56, 0.7)',
                  borderRadius: 14,
                  border: `1px solid ${C.borderGlass}`,
                  padding: '9px 9px 9px 16px',
                  backdropFilter: 'blur(16px)',
                }}>
                  <input
                    ref={qaInputRef}
                    value={qaInput}
                    onChange={e => setQaInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendQA()}
                    placeholder="Ask about the material…"
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      fontSize: 13.5, color: C.textPrimary,
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 300,
                    }}
                  />
                  <button
                    onClick={sendQA}
                    style={{
                      background: qaInput.trim() ? `linear-gradient(135deg, ${C.accent}, #A87840)` : 'rgba(245, 237, 216, 0.06)',
                      border: 'none', cursor: 'pointer',
                      color: qaInput.trim() ? '#141B2D' : 'rgba(245, 237, 216, 0.2)',
                      width: 34, height: 34, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: qaInput.trim() ? `0 3px 12px rgba(212, 175, 108, 0.28)` : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    <ArrowUp size={15} />
                  </button>
                </div>

                <button
                  onClick={() => setTab('concepts')}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: C.textDim, fontSize: 12,
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontFamily: "'DM Sans', sans-serif", alignSelf: 'center',
                    marginTop: 2,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'rgba(245, 237, 216, 0.6)'}
                  onMouseLeave={e => e.currentTarget.style.color = C.textDim}
                >
                  <BookOpen size={12} /> Back to concepts
                </button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onStartQuiz}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: `linear-gradient(135deg, ${C.accent} 0%, #A87840 100%)`,
                    border: 'none', borderRadius: 14, padding: '13px 24px',
                    color: '#141B2D', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    boxShadow: `0 4px 20px rgba(212, 175, 108, 0.28)`,
                  }}
                >
                  <Play size={15} /> Start Quiz
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── Non-fullscreen layout ──────────────────────────────────────────────
  return (
    <div style={{
      position: 'relative', zIndex: 5,
      flex: 1, display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 20px', flexShrink: 0,
        borderBottom: `1px solid ${C.borderGold}`,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: C.textDim, display: 'flex',
            borderRadius: 8, padding: 4, transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(245, 237, 216, 0.7)'}
          onMouseLeave={e => e.currentTarget.style.color = C.textDim}
        >
          <ArrowLeft size={17} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: 'italic',
            fontSize: 18, color: C.textPrimary, fontWeight: 400, margin: 0,
          }}>
            {courseName}
          </h2>
          <span style={{
            fontSize: 9.5, color: C.textDim,
            textTransform: 'uppercase', letterSpacing: '0.14em',
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
          }}>
            Study Mode
          </span>
        </div>
        <TabBar />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <AnimatePresence mode="wait">
          {tab === 'concepts' ? (
            <motion.div key="concepts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {concepts.map((c, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    background: C.glass,
                    border: `1px solid ${C.borderGlass}`,
                    borderLeft: `2px solid rgba(212, 175, 108, 0.35)`,
                    borderRadius: 14, padding: '14px 18px',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <h3 style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontStyle: 'italic',
                    fontSize: 16, color: C.textPrimary, fontWeight: 400,
                    margin: '0 0 7px',
                  }}>
                    {c.title}
                  </h3>
                  <p style={{ fontSize: 12.5, color: C.textSecond, lineHeight: 1.7, margin: '0 0 8px', fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                    {c.explanation}
                  </p>
                  {c.key_points && c.key_points.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 10 }}>
                      {c.key_points.map((pt: string, j: number) => (
                        <div key={j} style={{ fontSize: 11.5, color: 'rgba(245, 237, 216, 0.4)', display: 'flex', gap: 7, fontFamily: "'DM Sans', sans-serif" }}>
                          <span style={{ color: C.accent, opacity: 0.6 }}>·</span>{pt}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onStartQuiz}
                style={{
                  marginTop: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: `linear-gradient(135deg, ${C.accent} 0%, #A87840 100%)`,
                  border: 'none', borderRadius: 13, padding: '13px 20px',
                  color: '#141B2D', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  boxShadow: `0 4px 18px rgba(212, 175, 108, 0.28)`,
                }}
              >
                <Play size={15} /> Start Quiz
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="qa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {qaMessages.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '90%', padding: '9px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                  background: msg.role === 'user' ? 'rgba(212, 175, 108, 0.1)' : C.glass,
                  border: msg.role === 'user' ? `1px solid rgba(212, 175, 108, 0.2)` : `1px solid ${C.borderGlass}`,
                  fontSize: 13, lineHeight: 1.65, color: msg.role === 'user' ? C.textPrimary : C.textSecond,
                  backdropFilter: 'blur(12px)', whiteSpace: 'pre-wrap',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {renderMarkdown(msg.text)}
                </div>
              ))}
              <div style={{
                display: 'flex', gap: 6,
                background: 'rgba(26, 34, 56, 0.6)',
                borderRadius: 12, border: `1px solid ${C.borderGlass}`,
                padding: '8px 8px 8px 14px', marginTop: 4,
                backdropFilter: 'blur(12px)',
              }}>
                <input
                  value={qaInput}
                  onChange={e => setQaInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendQA()}
                  placeholder="Ask about the material…"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: C.textPrimary, fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}
                />
                <button onClick={sendQA} style={{
                  background: qaInput.trim() ? `linear-gradient(135deg, ${C.accent}, #A87840)` : 'rgba(245, 237, 216, 0.06)',
                  border: 'none', cursor: 'pointer',
                  color: qaInput.trim() ? '#141B2D' : 'rgba(245, 237, 216, 0.2)',
                  width: 30, height: 30, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                }}>
                  <ArrowUp size={13} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
