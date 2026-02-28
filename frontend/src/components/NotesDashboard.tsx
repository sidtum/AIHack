import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, RefreshCw, Mic, MicOff, Send, BookOpen } from 'lucide-react';

interface LectureSession {
  id: number;
  title: string;
  transcript: string | null;
  notes: string | null;
  created_at: string;
}

interface QAMessage {
  role: 'user' | 'ai';
  text: string;
}

interface NotesDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Simple markdown renderer (headings + bold + bullets) ─────────────────────
function MarkdownBlock({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(200,220,210,0.85)', fontFamily: "'DM Sans', sans-serif" }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <div key={i} style={{ fontWeight: 700, fontSize: 13, color: '#c8b4ff', marginTop: 14, marginBottom: 4 }}>
              {renderInline(line.slice(3))}
            </div>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <div key={i} style={{ fontWeight: 700, fontSize: 14, color: '#c8b4ff', marginTop: 16, marginBottom: 6 }}>
              {renderInline(line.slice(2))}
            </div>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} style={{ paddingLeft: 14, marginBottom: 2 }}>
              <span style={{ color: 'rgba(150,100,255,0.7)', marginRight: 6 }}>•</span>
              {renderInline(line.slice(2))}
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
        return <div key={i} style={{ marginBottom: 2 }}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#d4c4ff' }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

// ── Main Component ────────────────────────────────────────────────────────────
export function NotesDashboard({ isOpen, onClose }: NotesDashboardProps) {
  const [sessions, setSessions] = useState<LectureSession[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<LectureSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'transcript'>('notes');
  const [qaInput, setQaInput] = useState('');
  const [qaMessages, setQaMessages] = useState<QAMessage[]>([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const qaBottomRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('http://localhost:8000/lecture-sessions');
      const data = await r.json();
      setSessions(data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFullSession = useCallback(async (id: number) => {
    try {
      const r = await fetch(`http://localhost:8000/lecture-sessions/${id}`);
      if (r.ok) {
        const data: LectureSession = await r.json();
        setSelected(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (selectedId === null) { setSelected(null); return; }
    fetchFullSession(selectedId);
  }, [selectedId, fetchFullSession]);

  useEffect(() => {
    if (isOpen) fetchSessions();
  }, [isOpen, fetchSessions]);

  useEffect(() => {
    qaBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaMessages]);

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setProcessing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const form = new FormData();
          form.append('file', blob, 'lecture.webm');
          const r = await fetch('http://localhost:8000/process-lecture-audio', {
            method: 'POST',
            body: form,
          });
          const newSession: LectureSession = await r.json();
          await fetchSessions();
          setSelectedId(newSession.id);
          setSelected(newSession);
          setQaMessages([]);
          setActiveTab('notes');
        } catch {
          // ignore
        } finally {
          setProcessing(false);
        }
      };

      mr.start(1000);
      setRecording(true);
    } catch {
      alert('Microphone access denied. Please allow mic access and try again.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  // ── Title editing ──────────────────────────────────────────────────────────
  const handleTitleBlur = async () => {
    setEditingTitle(false);
    if (!selected || titleDraft === selected.title) return;
    await fetch(`http://localhost:8000/lecture-sessions/${selected.id}/title`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleDraft }),
    });
    setSelected(s => s ? { ...s, title: titleDraft } : s);
    setSessions(prev => prev.map(s => s.id === selected.id ? { ...s, title: titleDraft } : s));
  };

  // ── Q&A ───────────────────────────────────────────────────────────────────
  const sendQuestion = async () => {
    if (!qaInput.trim() || !selected || qaLoading) return;
    const q = qaInput.trim();
    setQaInput('');
    setQaMessages(prev => [...prev, { role: 'user', text: q }]);
    setQaLoading(true);
    try {
      const r = await fetch(`http://localhost:8000/lecture-sessions/${selected.id}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await r.json();
      setQaMessages(prev => [...prev, { role: 'ai', text: data.answer }]);
    } catch {
      setQaMessages(prev => [...prev, { role: 'ai', text: 'Sorry, could not reach the server.' }]);
    } finally {
      setQaLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: isOpen ? 0 : '100%' }}
      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
      style={{
        position: 'absolute',
        top: 48, right: 0, bottom: 0,
        width: '100%',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(150deg, #0a2020 0%, #0e2838 40%, #0c1a2e 100%)',
        borderLeft: '1.5px solid rgba(150,100,255,0.35)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: '1px solid rgba(150,100,255,0.2)',
        background: 'rgba(0,0,0,0.25)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(150,100,255,0.12)',
            border: '1px solid rgba(150,100,255,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={15} color="rgba(180,140,255,0.85)" />
          </div>
          <div>
            <div style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 20, fontWeight: 400, color: '#e8d8ff',
              letterSpacing: '-0.01em',
            }}>
              Lecture Notes
            </div>
            <div style={{
              fontSize: 11, color: 'rgba(200,220,210,0.45)',
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.04em',
            }}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={fetchSessions}
            title="Refresh"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: loading ? 'rgba(180,140,255,0.6)' : 'rgba(180,140,255,0.4)',
              width: 30, height: 30, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.2s',
            }}
          >
            <motion.div
              animate={{ rotate: loading ? 360 : 0 }}
              transition={loading ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
            >
              <RefreshCw size={14} />
            </motion.div>
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'rgba(200,180,255,0.4)',
              width: 30, height: 30, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(200,180,255,0.85)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(200,180,255,0.4)'; }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>

        {/* ── LEFT COLUMN: Session list ─────────────────────────────────── */}
        <div style={{
          flex: '0 0 200px', overflowY: 'auto', padding: '16px 12px 16px 20px',
          display: 'flex', flexDirection: 'column', gap: 8,
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Section label */}
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'rgba(180,140,255,0.5)',
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: 4, flexShrink: 0,
          }}>
            Sessions
          </div>

          {/* Record button */}
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={processing}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: recording
                ? '1px solid rgba(255,80,80,0.35)'
                : '1px solid rgba(150,100,255,0.28)',
              background: recording ? 'rgba(255,60,60,0.10)' : 'rgba(150,100,255,0.10)',
              color: recording ? 'rgba(255,120,120,0.9)' : 'rgba(180,140,255,0.85)',
              fontSize: 11, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: processing ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: processing ? 0.5 : 1,
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            {recording ? <MicOff size={12} /> : <Mic size={12} />}
            {recording ? 'Stop Recording' : 'Record Lecture'}
          </button>

          {processing && (
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{
                fontSize: 11, color: 'rgba(180,140,255,0.6)',
                fontFamily: "'DM Sans', sans-serif",
                textAlign: 'center', flexShrink: 0,
              }}
            >
              Processing audio...
            </motion.div>
          )}

          {/* Session cards */}
          {loading ? (
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{ fontSize: 12, color: 'rgba(200,220,210,0.4)', fontFamily: "'DM Sans', sans-serif", padding: '20px 0', textAlign: 'center' }}
            >
              Loading...
            </motion.div>
          ) : sessions.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '32px 12px', gap: 10,
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 10,
              border: '1px dashed rgba(150,100,255,0.18)',
            }}>
              <BookOpen size={24} color="rgba(150,100,255,0.25)" />
              <div style={{ fontSize: 11, color: 'rgba(200,220,210,0.35)', fontFamily: "'DM Sans', sans-serif", textAlign: 'center', lineHeight: 1.6 }}>
                No sessions yet.<br />
                <span style={{ fontSize: 11, opacity: 0.7 }}>Record a lecture to get started.</span>
              </div>
            </div>
          ) : (
            sessions.map(s => (
              <div
                key={s.id}
                onClick={() => {
                  setSelectedId(s.id);
                  setSelected(s as LectureSession);
                  setQaMessages([]);
                  setActiveTab('notes');
                }}
                style={{
                  background: selectedId === s.id ? 'rgba(150,100,255,0.10)' : 'rgba(255,255,255,0.035)',
                  border: `1px solid ${selectedId === s.id ? 'rgba(150,100,255,0.35)' : 'rgba(150,100,255,0.10)'}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f0e8d0', fontFamily: "'DM Sans', sans-serif", marginBottom: 3 }}>
                  {truncate(s.title || 'Untitled', 28)}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(200,220,210,0.4)', fontFamily: "'DM Sans', sans-serif" }}>
                  {fmtDate(s.created_at)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── RIGHT COLUMN: Session detail ──────────────────────────────── */}
        <div style={{
          flex: 3, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
          padding: '16px 24px 0 16px',
        }}>
          {!selected ? (
            <div style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12,
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 12,
              border: '1px dashed rgba(150,100,255,0.15)',
              margin: '0 0 16px 0',
            }}>
              <Mic size={28} color="rgba(150,100,255,0.25)" />
              <div style={{ fontSize: 12, color: 'rgba(200,220,210,0.35)', fontFamily: "'DM Sans', sans-serif", textAlign: 'center', lineHeight: 1.6 }}>
                Select a session to view notes<br />
                <span style={{ fontSize: 11, opacity: 0.7 }}>or record a new lecture</span>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Session header */}
              <div style={{ marginBottom: 12, flexShrink: 0 }}>
                {editingTitle ? (
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={e => setTitleDraft(e.target.value)}
                    onBlur={handleTitleBlur}
                    onKeyDown={e => e.key === 'Enter' && handleTitleBlur()}
                    style={{
                      width: '100%',
                      background: 'rgba(150,100,255,0.08)',
                      border: '1px solid rgba(150,100,255,0.28)',
                      borderRadius: 8,
                      padding: '5px 10px',
                      fontSize: 15, fontWeight: 600,
                      color: '#e8d8ff',
                      outline: 'none',
                      fontFamily: "'Instrument Serif', serif",
                      boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <div
                      onDoubleClick={() => { setTitleDraft(selected.title || ''); setEditingTitle(true); }}
                      title="Double-click to edit"
                      style={{
                        fontSize: 16, fontWeight: 400, color: '#e8d8ff',
                        fontFamily: "'Instrument Serif', serif",
                        cursor: 'text', userSelect: 'none', flex: 1,
                      }}
                    >
                      {selected.title || 'Untitled Lecture'}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(200,220,210,0.35)', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
                      {fmtDate(selected.created_at)}
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexShrink: 0 }}>
                {(['notes', 'transcript'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '3px 14px',
                      borderRadius: 20,
                      border: `1px solid ${activeTab === tab ? 'rgba(150,100,255,0.45)' : 'rgba(255,255,255,0.08)'}`,
                      background: activeTab === tab ? 'rgba(150,100,255,0.12)' : 'transparent',
                      color: activeTab === tab ? 'rgba(180,140,255,0.95)' : 'rgba(200,220,210,0.35)',
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Notes / Transcript content */}
              <div style={{
                flex: 1, overflowY: 'auto',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 12,
              }}>
                {activeTab === 'notes' && (
                  selected.notes
                    ? <MarkdownBlock text={selected.notes} />
                    : <div style={{ fontSize: 12, color: 'rgba(200,220,210,0.35)', fontFamily: "'DM Sans', sans-serif" }}>Notes not yet generated.</div>
                )}
                {activeTab === 'transcript' && (
                  selected.transcript
                    ? <pre style={{
                        fontSize: 12, lineHeight: 1.7,
                        color: 'rgba(200,220,210,0.8)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        margin: 0, fontFamily: "'DM Sans', sans-serif",
                      }}>{selected.transcript}</pre>
                    : <div style={{ fontSize: 12, color: 'rgba(200,220,210,0.35)', fontFamily: "'DM Sans', sans-serif" }}>Transcript not available.</div>
                )}
              </div>

              {/* Q&A section */}
              <div style={{
                flexShrink: 0,
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: 12,
                marginBottom: 16,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: 'rgba(180,140,255,0.45)',
                  fontFamily: "'DM Sans', sans-serif",
                  marginBottom: 8,
                }}>
                  Ask about this lecture
                </div>

                {/* Messages */}
                <div style={{ maxHeight: 130, overflowY: 'auto', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {qaMessages.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 12,
                        background: m.role === 'user' ? 'rgba(150,100,255,0.08)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${m.role === 'user' ? 'rgba(150,100,255,0.18)' : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: 8,
                        padding: '6px 10px',
                        color: m.role === 'user' ? 'rgba(200,180,255,0.9)' : 'rgba(200,220,210,0.85)',
                        fontFamily: "'DM Sans', sans-serif",
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ fontWeight: 700, marginRight: 4, fontSize: 10, letterSpacing: '0.06em', opacity: 0.6 }}>
                        {m.role === 'user' ? 'Q' : 'A'}
                      </span>
                      {m.text}
                    </div>
                  ))}
                  {qaLoading && (
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      style={{ fontSize: 11, color: 'rgba(180,140,255,0.5)', fontFamily: "'DM Sans', sans-serif", padding: '4px 0' }}
                    >
                      Thinking...
                    </motion.div>
                  )}
                  <div ref={qaBottomRef} />
                </div>

                {/* Input row */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={qaInput}
                    onChange={e => setQaInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendQuestion()}
                    placeholder="Ask a follow-up question..."
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: 8, padding: '7px 11px',
                      fontSize: 12, color: '#f0e8d0',
                      outline: 'none',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                  <button
                    onClick={sendQuestion}
                    disabled={!qaInput.trim() || qaLoading}
                    style={{
                      background: 'rgba(150,100,255,0.12)',
                      border: '1px solid rgba(150,100,255,0.28)',
                      borderRadius: 8, padding: '7px 11px',
                      cursor: qaInput.trim() && !qaLoading ? 'pointer' : 'default',
                      color: qaInput.trim() ? 'rgba(180,140,255,0.9)' : 'rgba(150,100,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'color 0.15s',
                    }}
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
}
