import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowUp, BookOpen, MessageCircle, ChevronLeft, ChevronRight, Play } from 'lucide-react';

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

  // Clear typing indicator when an agent message arrives
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
      // Last concept — switch to Q&A and focus input
      setTab('qa');
      setTimeout(() => qaInputRef.current?.focus(), 120);
    }
  };

  const concept = concepts[conceptIndex];

  // ── Full-screen layout ──────────────────────────────────────────────────
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
          borderBottom: '1px solid rgba(240,200,100,0.1)',
        }}>
          <button onClick={onBack} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,240,170,0.4)', display: 'flex',
          }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 20, color: '#ffe8b0', fontWeight: 400, margin: 0,
            }}>
              <em style={{ fontStyle: 'italic' }}>{courseName}</em>
            </h2>
            <span style={{
              fontSize: 10, color: 'rgba(200,230,210,0.35)',
              textTransform: 'uppercase', letterSpacing: '0.12em',
            }}>
              Study Mode
            </span>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 2 }}>
            {[
              { key: 'concepts' as const, icon: BookOpen, label: 'Concepts' },
              { key: 'qa' as const, icon: MessageCircle, label: 'Q&A' },
            ].map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 8,
                background: tab === key ? 'rgba(240,180,60,0.12)' : 'transparent',
                border: tab === key ? '1px solid rgba(240,180,60,0.2)' : '1px solid transparent',
                color: tab === key ? '#f0c050' : 'rgba(200,230,210,0.35)',
                fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                transition: 'all 0.2s',
              }}>
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
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
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                {/* Counter */}
                <div style={{
                  fontSize: 11, color: 'rgba(200,230,210,0.4)',
                  textTransform: 'uppercase', letterSpacing: '0.15em',
                  fontFamily: 'monospace', marginBottom: 24, textAlign: 'center',
                }}>
                  Concept {conceptIndex + 1} of {concepts.length}
                </div>

                {/* Concept card — animates between concepts */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={conceptIndex}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.22 }}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 18,
                      padding: '28px 32px',
                      backdropFilter: 'blur(8px)',
                      marginBottom: 28,
                    }}
                  >
                    <h3 style={{
                      fontFamily: "'Instrument Serif', serif",
                      fontSize: 22, color: '#ffe8b0', fontWeight: 400,
                      margin: '0 0 14px',
                    }}>
                      <em style={{ fontStyle: 'italic' }}>{concept?.title}</em>
                    </h3>
                    <p style={{ fontSize: 14.5, color: '#cce0d8', lineHeight: 1.75, margin: '0 0 16px' }}>
                      {concept?.explanation}
                    </p>
                    {concept?.key_points && concept.key_points.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
                        {concept.key_points.map((pt, j) => (
                          <div key={j} style={{ fontSize: 13, color: 'rgba(200,230,210,0.6)', display: 'flex', gap: 8, lineHeight: 1.6 }}>
                            <span style={{ color: 'rgba(240,180,60,0.5)', flexShrink: 0 }}>·</span>
                            {pt}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Prev / Got it navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 24 }}>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setConceptIndex(i => i - 1)}
                    disabled={conceptIndex === 0}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: conceptIndex === 0 ? 'transparent' : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, padding: '10px 18px',
                      color: conceptIndex === 0 ? 'rgba(200,230,210,0.2)' : 'rgba(200,230,210,0.6)',
                      fontSize: 13, cursor: conceptIndex === 0 ? 'default' : 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
                      transition: 'all 0.2s',
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
                      background: 'rgba(240,180,60,0.12)',
                      border: '1px solid rgba(240,180,60,0.25)',
                      borderRadius: 10, padding: '10px 20px',
                      color: '#f0c050', fontSize: 13,
                      cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                      transition: 'all 0.2s',
                    }}
                  >
                    {conceptIndex === concepts.length - 1 ? 'Got it ✓' : <>Got it <ChevronRight size={15} /></>}
                  </motion.button>
                </div>

                {/* Start Quiz — always visible */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onStartQuiz}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: 'linear-gradient(135deg, #d4a030, #a07020)',
                    border: 'none', borderRadius: 14, padding: '14px 24px',
                    color: '#fff8e0', fontSize: 15, fontWeight: 500,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    boxShadow: '0 4px 20px rgba(200,140,20,0.3)',
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
                style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}
              >
                {/* QA Messages */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200 }}>
                  {qaMessages.length === 0 && !isQATyping && (
                    <div style={{ textAlign: 'center', padding: '48px 20px', color: 'rgba(200,230,210,0.3)', fontSize: 13 }}>
                      Ask questions about the course material. I'll use the scraped content to give you targeted answers.
                    </div>
                  )}
                  {qaMessages.map((msg, i) => (
                    <div key={i} style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      padding: '11px 16px',
                      borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                      background: msg.role === 'user'
                        ? 'linear-gradient(135deg, rgba(200,150,40,0.35), rgba(150,110,30,0.25))'
                        : 'rgba(255,255,255,0.05)',
                      border: msg.role === 'user'
                        ? '1px solid rgba(240,180,60,0.25)'
                        : '1px solid rgba(255,255,255,0.07)',
                      fontSize: 13.5, lineHeight: 1.7,
                      color: msg.role === 'user' ? '#fff0cc' : '#cce0d8',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {renderMarkdown(msg.text)}
                    </div>
                  ))}
                  <AnimatePresence>
                    {isQATyping && (
                      <motion.div
                        key="qa-typing"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        style={{ alignSelf: 'flex-start', maxWidth: '85%' }}
                      >
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,200,100,0.55)', marginBottom: 5, paddingLeft: 4, fontWeight: 400 }}>SAYAM</p>
                        <div style={{ padding: '12px 16px', borderRadius: '4px 16px 16px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}>
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
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '10px 10px 10px 16px',
                }}>
                  <input
                    ref={qaInputRef}
                    value={qaInput}
                    onChange={e => setQaInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendQA()}
                    placeholder="Ask about the material..."
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      fontSize: 14, color: '#f0e8d0', fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                  <button onClick={sendQA} style={{
                    background: qaInput.trim() ? 'linear-gradient(135deg, #d4a030, #a07020)' : 'rgba(255,255,255,0.05)',
                    border: 'none', cursor: 'pointer',
                    color: qaInput.trim() ? '#fff8e0' : 'rgba(255,240,180,0.25)',
                    width: 34, height: 34, borderRadius: 9,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ArrowUp size={15} />
                  </button>
                </div>

                {/* Back to concepts link */}
                <button onClick={() => setTab('concepts')} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'rgba(200,230,210,0.3)', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontFamily: "'DM Sans', sans-serif", alignSelf: 'center',
                  marginTop: 4,
                }}>
                  <BookOpen size={12} /> Back to concepts
                </button>

                {/* Start Quiz always visible in Q&A tab too */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onStartQuiz}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: 'linear-gradient(135deg, #d4a030, #a07020)',
                    border: 'none', borderRadius: 14, padding: '13px 24px',
                    color: '#fff8e0', fontSize: 14, fontWeight: 500,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    boxShadow: '0 4px 20px rgba(200,140,20,0.3)',
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

  // ── Non-fullscreen (legacy) layout ──────────────────────────────────────
  return (
    <div style={{
      position: 'relative', zIndex: 5,
      flex: 1, display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 22px', flexShrink: 0,
        borderBottom: '1px solid rgba(240,200,100,0.1)',
      }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,240,170,0.4)', display: 'flex' }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 18, color: '#ffe8b0', fontWeight: 400, margin: 0 }}>
            <em style={{ fontStyle: 'italic' }}>{courseName}</em>
          </h2>
          <span style={{ fontSize: 10, color: 'rgba(200,230,210,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Study Mode
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 2 }}>
          {[
            { key: 'concepts' as const, icon: BookOpen, label: 'Concepts' },
            { key: 'qa' as const, icon: MessageCircle, label: 'Q&A' },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8,
              background: tab === key ? 'rgba(240,180,60,0.12)' : 'transparent',
              border: tab === key ? '1px solid rgba(240,180,60,0.2)' : '1px solid transparent',
              color: tab === key ? '#f0c050' : 'rgba(200,230,210,0.35)',
              fontSize: 11, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.2s',
            }}>
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
        <AnimatePresence mode="wait">
          {tab === 'concepts' ? (
            <motion.div key="concepts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {concepts.map((c, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 14,
                    padding: '14px 18px',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <h3 style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontSize: 15, color: '#ffe8b0', fontWeight: 400,
                    margin: '0 0 8px',
                  }}>
                    <em style={{ fontStyle: 'italic' }}>{c.title}</em>
                  </h3>
                  <p style={{ fontSize: 12.5, color: '#cce0d8', lineHeight: 1.7, margin: '0 0 8px' }}>
                    {c.explanation}
                  </p>
                  {c.key_points && c.key_points.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 12 }}>
                      {c.key_points.map((pt: string, j: number) => (
                        <div key={j} style={{ fontSize: 11.5, color: 'rgba(200,230,210,0.5)', display: 'flex', gap: 6 }}>
                          <span style={{ color: 'rgba(240,180,60,0.4)' }}>-</span>
                          {pt}
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
                  background: 'linear-gradient(135deg, #d4a030, #a07020)',
                  border: 'none', borderRadius: 14, padding: '14px 24px',
                  color: '#fff8e0', fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  boxShadow: '0 4px 20px rgba(200,140,20,0.3)',
                }}
              >
                <Play size={16} /> Start Quiz
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="qa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {qaMessages.length === 0 && !isQATyping && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(200,230,210,0.3)', fontSize: 12 }}>
                    Ask questions about the course material. I'll use the scraped content to give you targeted answers.
                  </div>
                )}
                {qaMessages.map((msg, i) => (
                  <div key={i} style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, rgba(200,150,40,0.35), rgba(150,110,30,0.25))'
                      : 'rgba(255,255,255,0.05)',
                    border: msg.role === 'user'
                      ? '1px solid rgba(240,180,60,0.25)'
                      : '1px solid rgba(255,255,255,0.07)',
                    fontSize: 12.5, lineHeight: 1.7,
                    color: msg.role === 'user' ? '#fff0cc' : '#cce0d8',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {renderMarkdown(msg.text)}
                  </div>
                ))}
                <AnimatePresence>
                  {isQATyping && (
                    <motion.div
                      key="qa-typing-small"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      style={{ alignSelf: 'flex-start', maxWidth: '85%' }}
                    >
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,200,100,0.55)', marginBottom: 4, paddingLeft: 4, fontWeight: 400 }}>SAYAM</p>
                      <div style={{ padding: '10px 14px', borderRadius: '4px 16px 16px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <TypingDots />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={bottomRef} />
              </div>

              <div style={{
                display: 'flex', gap: 6,
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '8px 8px 8px 14px',
              }}>
                <input
                  ref={qaInputRef}
                  value={qaInput}
                  onChange={e => setQaInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendQA()}
                  placeholder="Ask about the material..."
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: 13, color: '#f0e8d0', fontFamily: "'DM Sans', sans-serif",
                  }}
                />
                <button onClick={sendQA} style={{
                  background: qaInput.trim() ? 'linear-gradient(135deg, #d4a030, #a07020)' : 'rgba(255,255,255,0.05)',
                  border: 'none', cursor: 'pointer',
                  color: qaInput.trim() ? '#fff8e0' : 'rgba(255,240,180,0.25)',
                  width: 32, height: 32, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ArrowUp size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
