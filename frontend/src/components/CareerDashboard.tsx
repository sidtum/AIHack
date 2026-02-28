import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Briefcase, FileText, ExternalLink, RefreshCw } from 'lucide-react';

interface JobApplication {
  id: number;
  company: string;
  role_title: string;
  url: string;
  status: string;
  applied_date: string;
  tailored_resume_path: string | null;
}

interface CareerDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const C = {
  accent: '#D4AF6C',
  teal: '#89CEC2',
  textPrimary: '#F5EDD8',
  textSecond: 'rgba(245, 237, 216, 0.6)',
  textDim: 'rgba(245, 237, 216, 0.35)',
  glass: 'rgba(26, 34, 56, 0.65)',
  borderGold: 'rgba(212, 175, 108, 0.14)',
  borderGlass: 'rgba(245, 237, 216, 0.08)',
  green: '#7DD8B8',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Applied: { bg: 'rgba(212,175,108,0.1)', text: '#D4AF6C', border: 'rgba(212,175,108,0.25)' },
  OA: { bg: 'rgba(232,160,80,0.1)', text: 'rgba(232,185,100,0.9)', border: 'rgba(232,160,80,0.25)' },
  Interview: { bg: 'rgba(100,170,255,0.1)', text: 'rgba(130,190,255,0.9)', border: 'rgba(100,170,255,0.25)' },
  Offer: { bg: 'rgba(125,216,184,0.1)', text: '#7DD8B8', border: 'rgba(125,216,184,0.25)' },
  Rejected: { bg: 'rgba(212,112,112,0.1)', text: '#D47070', border: 'rgba(212,112,112,0.22)' },
};

const STATUS_OPTIONS = ['Applied', 'OA', 'Interview', 'Offer', 'Rejected'];

function StatusSelect({ appId, status, onUpdate }: {
  appId: number; status: string; onUpdate: (id: number, s: string) => void;
}) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS['Applied'];
  return (
    <select
      value={status}
      onChange={e => {
        const next = e.target.value;
        fetch(`http://127.0.0.1:8000/job-applications/${appId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        });
        onUpdate(appId, next);
      }}
      style={{
        fontSize: 9.5, fontWeight: 500, letterSpacing: '0.08em',
        textTransform: 'uppercase', padding: '2px 8px',
        borderRadius: 18, fontFamily: "'JetBrains Mono', monospace",
        background: c.bg, color: c.text, border: `1px solid ${c.border}`,
        cursor: 'pointer', appearance: 'none', outline: 'none',
      }}
    >
      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

export function CareerDashboard({ isOpen, onClose }: CareerDashboardProps) {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchApplications = () => {
    setLoading(true);
    fetch('http://127.0.0.1:8000/job-applications')
      .then(r => r.json())
      .then((data: unknown) => setApplications(Array.isArray(data) ? (data as JobApplication[]) : []))
      .catch(() => setApplications([]))
      .finally(() => setLoading(false));
  };

  const handleStatusUpdate = (id: number, newStatus: string) => {
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
  };

  useEffect(() => {
    if (isOpen) fetchApplications();
  }, [isOpen]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'Z').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch (_) {
      return dateStr;
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: isOpen ? 0 : '100%' }}
      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
      style={{
        position: 'absolute',
        top: 52, right: 0, bottom: 0,
        width: '100%',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, #101828 0%, #141B2D 60%, #0E1420 100%)',
        borderLeft: `1.5px solid ${C.borderGold}`,
        boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: `1px solid ${C.borderGlass}`,
        background: 'rgba(14, 20, 32, 0.6)',
        backdropFilter: 'blur(16px)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(212,175,108,0.1)',
            border: `1px solid ${C.borderGold}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Briefcase size={15} color={C.accent} />
          </div>
          <div>
            <div style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontSize: 20, fontWeight: 400, color: C.textPrimary,
              letterSpacing: '-0.01em',
            }}>
              Career Dashboard
            </div>
            <div style={{
              fontSize: 10, color: C.textDim,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 300,
            }}>
              {applications.length} application{applications.length !== 1 ? 's' : ''} tracked
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={fetchApplications}
            title="Refresh"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: loading ? C.accent : C.textDim,
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
              background: 'rgba(245, 237, 216, 0.06)', border: `1px solid ${C.borderGlass}`,
              cursor: 'pointer', color: C.textDim,
              width: 30, height: 30, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = C.textPrimary; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.textDim; }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>

        {/* LEFT: Applications */}
        <div style={{
          flex: 3, overflowY: 'auto', padding: '18px 14px 18px 22px',
          display: 'flex', flexDirection: 'column', gap: 8,
          borderRight: `1px solid ${C.borderGlass}`,
        }}>
          <div style={{
            fontSize: 9.5, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: C.accent, opacity: 0.6,
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
            marginBottom: 4, flexShrink: 0,
          }}>
            Applications
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ fontSize: 12, color: C.textDim, fontFamily: "'DM Sans', sans-serif" }}
              >
                Loading…
              </motion.div>
            </div>
          ) : applications.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '40px 16px', gap: 12,
              background: C.glass, backdropFilter: 'blur(8px)',
              borderRadius: 13,
              border: `1px dashed ${C.borderGold}`,
            }}>
              <Briefcase size={26} color={C.textDim} />
              <div style={{ fontSize: 12, color: C.textDim, fontFamily: "'DM Sans', sans-serif", textAlign: 'center', lineHeight: 1.65 }}>
                No applications yet.<br />
                <span style={{ fontSize: 11, opacity: 0.7 }}>Say "apply to internships" to get started.</span>
              </div>
            </div>
          ) : (
            applications.map(app => (
              <div
                key={app.id}
                style={{
                  background: C.glass,
                  backdropFilter: 'blur(8px)',
                  border: `1px solid ${C.borderGlass}`,
                  borderRadius: 11,
                  padding: '11px 13px',
                  display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', gap: 10,
                  flexShrink: 0, transition: 'border-color 0.15s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, fontFamily: "'DM Sans', sans-serif" }}>
                      {app.company}
                    </span>
                    <StatusSelect appId={app.id} status={app.status} onUpdate={handleStatusUpdate} />
                  </div>
                  <div style={{ fontSize: 11.5, color: C.textSecond, fontFamily: "'DM Sans', sans-serif", marginBottom: 3 }}>
                    {app.role_title}
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>
                    {formatDate(app.applied_date)}
                  </div>
                </div>

                {app.url && (
                  <button
                    onClick={() => {
                      const ipc = (window as any).require?.('electron')?.ipcRenderer;
                      ipc?.send('browser-navigate', app.url);
                      onClose();
                    }}
                    title="Open job listing in browser"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: C.textDim,
                      display: 'flex', alignItems: 'center',
                      flexShrink: 0, marginTop: 2,
                      transition: 'color 0.15s', padding: 4, borderRadius: 6,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = C.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.color = C.textDim; }}
                  >
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* RIGHT: Tailored Resumes */}
        <div style={{
          flex: 2, overflowY: 'auto', padding: '18px 22px 18px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{
            fontSize: 9.5, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: C.teal, opacity: 0.6,
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 300,
            marginBottom: 4, flexShrink: 0,
          }}>
            Tailored Resumes
          </div>

          {applications.filter(app => app.tailored_resume_path).length === 0 ? (
            <div style={{
              background: C.glass, backdropFilter: 'blur(8px)',
              borderRadius: 11,
              border: `1px dashed ${C.borderGlass}`,
              padding: '28px 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <FileText size={22} color={C.textDim} />
              <div style={{ fontSize: 11, color: C.textDim, fontFamily: "'DM Sans', sans-serif", textAlign: 'center', lineHeight: 1.65 }}>
                Tailored resumes will appear here once the AI generates them.
              </div>
            </div>
          ) : (
            applications.filter(app => app.tailored_resume_path).map(app => (
              <div
                key={app.id}
                style={{
                  background: C.glass,
                  backdropFilter: 'blur(8px)',
                  border: `1px solid ${C.borderGlass}`,
                  borderRadius: 11,
                  padding: '10px 12px',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 8,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <FileText size={12} color={C.green} style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: C.textPrimary, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {app.company}
                    </div>
                    <div style={{ fontSize: 10, color: C.green, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, marginTop: 2 }}>
                      Ready
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const ipc = (window as any).require?.('electron')?.ipcRenderer;
                    ipc?.send('open-file', app.tailored_resume_path);
                  }}
                  style={{
                    background: 'rgba(125,216,184,0.08)',
                    border: '1px solid rgba(125,216,184,0.2)',
                    borderRadius: 7, padding: '3px 9px',
                    fontSize: 10, fontWeight: 500,
                    color: C.green,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                    flexShrink: 0, transition: 'all 0.15s',
                  }}
                >
                  Open
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </motion.div>
  );
}
