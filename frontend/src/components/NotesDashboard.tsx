import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Mic, Send, Sparkles, BookOpen } from 'lucide-react';

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

const C = {
  accent: '#FF7E67',
  lavender: '#B48CDC',
  teal: '#4ECDC4',
  textPrimary: '#FFFFFF',
  textSecond: 'rgba(255, 255, 255, 0.75)',
  textDim: 'rgba(255, 255, 255, 0.45)',
  glass: 'rgba(20, 25, 38, 0.45)',
  borderGold: 'rgba(255, 255, 255, 0.15)',
  borderGlass: 'rgba(255, 255, 255, 0.08)',
};

// ── Markdown renderer ──────────────────────────────────────────────────────
function MarkdownBlock({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div style={{ fontSize: 13, lineHeight: 1.8, color: C.textSecond, fontFamily: "'DM Sans', sans-serif" }}>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <div key={i} style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 18, color: C.lavender, marginTop: 20, marginBottom: 8, letterSpacing: '0.01em' }}>
              {renderInline(line.slice(3))}
            </div>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <div key={i} style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 22, color: '#FFD875', marginTop: 24, marginBottom: 12, letterSpacing: '0.01em' }}>
              {renderInline(line.slice(2))}
            </div>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} style={{ paddingLeft: 18, marginBottom: 6, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 4, top: 4, color: C.teal, opacity: 0.8, fontSize: 10 }}>✦</span>
              {renderInline(line.slice(2))}
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: 10 }} />;
        return <div key={i} style={{ marginBottom: 4 }}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: C.textPrimary, fontWeight: 500 }}>{part.slice(2, -2)}</strong>;
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

// ── Main Component ─────────────────────────────────────────────────────────
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

  // ── Recording ─────────────────────────────────────────────────────────────
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

  // ── Title editing ─────────────────────────────────────────────────────────
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

  // ── Q&A ──────────────────────────────────────────────────────────────────
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
      initial={{ y: '100%' }}
      animate={{ y: isOpen ? 0 : '100%' }}
      transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.8 }}
      style={{
        position: 'absolute',
        top: 42, left: 0, right: 0, bottom: 0, // Header is 42px now
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        background: '#04070A', // Deep dark base
        overflow: 'hidden',
      }}
    >
      {/* ── Breathtaking Ambient Background ── */}
      <div style={{
        position: 'absolute', inset: '-20%', zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(circle at 10% 20%, rgba(255, 126, 103, 0.55), transparent 45%),
          radial-gradient(circle at 90% 10%, rgba(180, 140, 220, 0.45), transparent 50%),
          radial-gradient(circle at 30% 80%, rgba(78, 205, 196, 0.5), transparent 55%),
          radial-gradient(circle at 80% 90%, rgba(255, 216, 117, 0.4), transparent 45%)
        `,
        filter: 'blur(70px)',
      }} />

      {/* Heavy noise film grain overlay overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        opacity: 0.45, mixBlendMode: 'color-dodge',
        filter: 'contrast(180%) brightness(140%) grayscale(100%)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat', backgroundSize: '140px'
      }} />

      {/* Light darkening overall to ensure text readabiity */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'rgba(4, 7, 10, 0.25)'
      }} />


      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '32px 40px 16px',
        flexShrink: 0,
      }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : 10 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          style={{ display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(180,140,220,0.2), rgba(255,126,103,0.1))',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Inner glow */}
            <div style={{ position: 'absolute', inset: -10, background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 60%)', filter: 'blur(5px)', opacity: 0.5 }} />
            <Sparkles size={20} color="#FFFFFF" style={{ filter: 'drop-shadow(0 2px 8px rgba(255,255,255,0.8))' }} />
          </div>
          <div>
            <div style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontSize: 32, fontWeight: 400, color: C.textPrimary,
              letterSpacing: '-0.02em', lineHeight: 1,
              textShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>
              Lecture Archive
            </div>
            <div style={{
              fontSize: 11, color: C.textDim, marginTop: 4,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.12em',
            }}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} captured
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : 10 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <button
            onClick={fetchSessions}
            title="Refresh"
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
              color: loading ? C.textPrimary : C.textSecond,
              width: 36, height: 36, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(12px)',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = C.textPrimary; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = C.textSecond; }}
          >
            <motion.div
              animate={{ rotate: loading ? 360 : 0 }}
              transition={loading ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
            >
              <RefreshCw size={15} />
            </motion.div>
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.1)`,
              cursor: 'pointer', color: C.textSecond,
              width: 36, height: 36, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(12px)',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,70,70,0.3)'; e.currentTarget.style.borderColor = 'rgba(212,70,70,0.5)'; e.currentTarget.style.color = '#FFF'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = C.textSecond; }}
          >
            <X size={16} />
          </button>
        </motion.div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0, position: 'relative', zIndex: 10 }}>

        {/* ── LEFT: Session list ──────────────────────────────────────────── */}
        <div style={{
          flex: '0 0 280px', overflowY: 'auto', padding: '10px 16px 30px 40px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {/* Record button */}
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={processing}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 16,
              border: recording
                ? '1px solid rgba(212,70,70,0.4)'
                : '1px solid rgba(255,255,255,0.15)',
              background: recording ? 'rgba(212,70,70,0.15)' : 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              color: recording ? '#FFa2a2' : C.textPrimary,
              fontSize: 12, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.04em',
              cursor: processing ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: processing ? 0.6 : 1,
              transition: 'all 0.2s',
              boxShadow: recording ? '0 0 24px rgba(212,70,70,0.4)' : '0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
              flexShrink: 0,
            }}
            onMouseEnter={e => { if (!recording && !processing) { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
            onMouseLeave={e => { if (!recording && !processing) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
          >
            {recording ? (
              <>
                <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff6b6b', boxShadow: '0 0 10px #ff6b6b' }} />
                </motion.div>
                STOP RECORDING
              </>
            ) : (
              <><Mic size={14} /> NEW RECORDING</>
            )}
          </button>

          {processing && (
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{
                fontSize: 12, color: C.lavender,
                fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                textAlign: 'center', flexShrink: 0, padding: '10px 0',
              }}
            >
              Analyzing audio transcript...
            </motion.div>
          )}

          <div style={{ margin: '12px 0 4px', height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.1), transparent)' }} />

          {/* Session cards */}
          {loading ? (
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{ fontSize: 13, color: C.textSecond, fontFamily: "'DM Sans', sans-serif", padding: '20px 0', textAlign: 'center' }}
            >
              Syncing archives...
            </motion.div>
          ) : sessions.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '40px 20px', gap: 14,
              background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)',
              borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)',
            }}>
              <BookOpen size={28} color={C.textDim} strokeWidth={1.5} />
              <div style={{ fontSize: 13, color: C.textSecond, fontFamily: "'DM Sans', sans-serif", textAlign: 'center', lineHeight: 1.6 }}>
                Your archive is empty.<br />Record a lecture to begin.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedId(s.id);
                    setSelected(s as LectureSession);
                    setQaMessages([]);
                    setActiveTab('notes');
                  }}
                  style={{
                    background: selectedId === s.id ? 'rgba(255,255,255,0.12)' : 'rgba(10, 14, 22, 0.4)',
                    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    border: `1px solid ${selectedId === s.id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: selectedId === s.id ? '0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)' : '0 4px 12px rgba(0,0,0,0.2)',
                    borderRadius: 14,
                    padding: '16px 18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                    position: 'relative', overflow: 'hidden',
                  }}
                  onMouseEnter={e => { if (selectedId !== s.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateX(4px)'; } }}
                  onMouseLeave={e => { if (selectedId !== s.id) { e.currentTarget.style.background = 'rgba(10, 14, 22, 0.4)'; e.currentTarget.style.transform = 'translateX(0)'; } }}
                >
                  {selectedId === s.id && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: C.teal, boxShadow: `0 0 10px ${C.teal}` }} />
                  )}
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: C.textPrimary, fontFamily: "'DM Sans', sans-serif", marginBottom: 6, lineHeight: 1.4 }}>
                    {truncate(s.title || 'Untitled', 36)}
                  </div>
                  <div style={{ fontSize: 10, color: selectedId === s.id ? 'rgba(255,255,255,0.7)' : C.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, letterSpacing: '0.04em' }}>
                    {fmtDate(s.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Session detail ──────────────────────────────────────── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden',
          padding: '10px 40px 30px 20px',
        }}>
          {!selected ? (
            <div style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 20,
              background: 'rgba(20, 25, 38, 0.3)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
              borderRadius: 24,
              border: `1px solid rgba(255,255,255,0.06)`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mic size={26} color={C.textDim} />
              </div>
              <div style={{ fontSize: 16, color: C.textSecond, fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', textAlign: 'center', letterSpacing: '0.02em' }}>
                Select a session to view notes<br />
                <span style={{ fontSize: 14, color: C.textDim, fontFamily: "'DM Sans', sans-serif", fontStyle: 'normal' }}>or record a new lecture</span>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                transition={{ duration: 0.3 }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
                  background: 'rgba(20, 25, 38, 0.35)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
                  borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
                  overflow: 'hidden',
                }}
              >
                {/* Panel Header */}
                <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
                    <div style={{ flex: 1 }}>
                      {editingTitle ? (
                        <input
                          autoFocus
                          value={titleDraft}
                          onChange={e => setTitleDraft(e.target.value)}
                          onBlur={handleTitleBlur}
                          onKeyDown={e => e.key === 'Enter' && handleTitleBlur()}
                          style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 10,
                            padding: '6px 14px',
                            fontSize: 28, fontWeight: 400,
                            color: C.textPrimary,
                            outline: 'none',
                            fontFamily: "'Instrument Serif', serif", fontStyle: 'italic',
                            boxSizing: 'border-box',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                          }}
                        />
                      ) : (
                        <div
                          onDoubleClick={() => { setTitleDraft(selected.title || ''); setEditingTitle(true); }}
                          title="Double-click to edit"
                          style={{
                            fontSize: 34, fontWeight: 400, color: C.textPrimary,
                            fontFamily: "'Instrument Serif', serif",
                            fontStyle: 'italic', lineHeight: 1.1,
                            cursor: 'text', userSelect: 'none',
                            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                            marginBottom: 8,
                          }}
                        >
                          {selected.title || 'Untitled Lecture'}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: C.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, letterSpacing: '0.06em' }}>
                        CAPTURED {fmtDate(selected.created_at).toUpperCase()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: 20, padding: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                      {(['notes', 'transcript'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          style={{
                            padding: '6px 16px',
                            borderRadius: 16,
                            border: 'none',
                            background: activeTab === tab ? 'rgba(255,255,255,0.15)' : 'transparent',
                            color: activeTab === tab ? '#FFF' : C.textDim,
                            fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            fontFamily: "'DM Sans', sans-serif",
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                          }}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                  {/* Notes / Transcript content */}
                  <div style={{
                    flex: 2, overflowY: 'auto',
                    padding: '28px 32px',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {activeTab === 'notes' && (
                      selected.notes
                        ? <MarkdownBlock text={selected.notes} />
                        : <div style={{ fontSize: 14, color: C.textDim, fontFamily: "'DM Sans', sans-serif", fontStyle: 'italic' }}>Notes have not been generated yet.</div>
                    )}
                    {activeTab === 'transcript' && (
                      selected.transcript
                        ? <pre style={{
                          fontSize: 13, lineHeight: 1.8,
                          color: C.textSecond,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          margin: 0, fontFamily: "'DM Sans', sans-serif",
                        }}>{selected.transcript}</pre>
                        : <div style={{ fontSize: 14, color: C.textDim, fontFamily: "'DM Sans', sans-serif", fontStyle: 'italic' }}>Transcript not available.</div>
                    )}
                  </div>

                  {/* Q&A sidebar inside the panel */}
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    background: 'rgba(0,0,0,0.15)',
                  }}>
                    <div style={{
                      padding: '24px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      fontSize: 11, letterSpacing: '0.14em',
                      textTransform: 'uppercase', color: C.lavender,
                      fontFamily: "'JetBrains Mono', monospace", fontWeight: 400,
                    }}>
                      Ask Assistant
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {qaMessages.length === 0 && !qaLoading && (
                        <div style={{ textAlign: 'center', opacity: 0.4, marginTop: 40 }}>
                          <Sparkles size={24} style={{ margin: '0 auto 12px' }} />
                          <div style={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>Ask questions about concepts you don't understand from this lecture.</div>
                        </div>
                      )}

                      {qaMessages.map((m, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 12.5,
                            background: m.role === 'user' ? 'rgba(78, 205, 196, 0.15)' : 'rgba(255,255,255,0.06)',
                            border: `1px solid ${m.role === 'user' ? 'rgba(78, 205, 196, 0.3)' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: '14px 14px 14px 4px',
                            borderBottomRightRadius: m.role === 'user' ? 4 : 14,
                            borderBottomLeftRadius: m.role === 'user' ? 14 : 4,
                            padding: '10px 14px',
                            color: m.role === 'user' ? '#E0F8F6' : C.textSecond,
                            fontFamily: "'DM Sans', sans-serif",
                            lineHeight: 1.6,
                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '90%',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          }}
                        >
                          {m.text}
                        </div>
                      ))}
                      {qaLoading && (
                        <motion.div
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                          style={{ fontSize: 12, color: C.teal, opacity: 0.8, fontFamily: "'DM Sans', sans-serif", padding: '8px 4px', alignSelf: 'flex-start' }}
                        >
                          Thinking...
                        </motion.div>
                      )}
                      <div ref={qaBottomRef} />
                    </div>

                    <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.2)' }}>
                      <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
                        <input
                          value={qaInput}
                          onChange={e => setQaInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendQuestion()}
                          placeholder="Follow-up question…"
                          style={{
                            flex: 1, background: 'transparent',
                            border: 'none', padding: '6px 10px',
                            fontSize: 13, color: C.textPrimary,
                            outline: 'none', fontFamily: "'DM Sans', sans-serif",
                          }}
                        />
                        <button
                          onClick={sendQuestion}
                          disabled={!qaInput.trim() || qaLoading}
                          style={{
                            background: qaInput.trim() && !qaLoading ? 'rgba(78, 205, 196, 0.2)' : 'transparent',
                            border: 'none', borderRadius: 8, width: 32, height: 32,
                            cursor: qaInput.trim() && !qaLoading ? 'pointer' : 'default',
                            color: qaInput.trim() ? '#4ECDC4' : C.textDim,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <Send size={14} style={{ transform: 'translateX(-1px)' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

      </div>
    </motion.div>
  );
}
