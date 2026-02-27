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

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Applied:   { bg: 'rgba(240,180,60,0.12)',  text: 'rgba(240,200,100,0.85)', border: 'rgba(240,180,60,0.28)' },
  OA:        { bg: 'rgba(255,140,0,0.12)',   text: 'rgba(255,165,60,0.9)',   border: 'rgba(255,140,0,0.28)' },
  Interview: { bg: 'rgba(60,140,255,0.12)',  text: 'rgba(100,180,255,0.9)',  border: 'rgba(60,140,255,0.28)' },
  Offer:     { bg: 'rgba(120,200,80,0.12)',  text: 'rgba(150,230,100,0.85)', border: 'rgba(120,200,80,0.28)' },
  Rejected:  { bg: 'rgba(255,80,80,0.10)',   text: 'rgba(255,120,120,0.8)',  border: 'rgba(255,80,80,0.22)' },
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
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', padding: '2px 8px',
        borderRadius: 20, fontFamily: "'DM Sans', sans-serif",
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
        top: 48, right: 0, bottom: 0,
        width: '100%',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(150deg, #0a2020 0%, #0e2838 40%, #0c1a2e 100%)',
        borderLeft: '1.5px solid rgba(240,180,60,0.35)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: '1px solid rgba(240,180,60,0.2)',
        background: 'rgba(0,0,0,0.25)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(240,180,60,0.12)',
            border: '1px solid rgba(240,180,60,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Briefcase size={15} color="rgba(240,200,100,0.85)" />
          </div>
          <div>
            <div style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: 20, fontWeight: 400, color: '#ffe8b0',
              letterSpacing: '-0.01em',
            }}>
              Career Dashboard
            </div>
            <div style={{
              fontSize: 11, color: 'rgba(200,220,210,0.45)',
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.04em',
            }}>
              {applications.length} application{applications.length !== 1 ? 's' : ''} tracked
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={fetchApplications}
            title="Refresh"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: loading ? 'rgba(240,200,100,0.6)' : 'rgba(240,200,100,0.4)',
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
              color: 'rgba(255,240,170,0.4)',
              width: 30, height: 30, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,240,170,0.8)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,240,170,0.4)'; }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content — side-by-side columns, each independently scrollable */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>

        {/* ── LEFT COLUMN: Applications (wider, flex 3) ── */}
        <div style={{
          flex: 3, overflowY: 'auto', padding: '20px 16px 20px 24px',
          display: 'flex', flexDirection: 'column', gap: 10,
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'rgba(240,200,100,0.5)',
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: 4, flexShrink: 0,
          }}>
            Applications
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ fontSize: 12, color: 'rgba(200,220,210,0.4)', fontFamily: "'DM Sans', sans-serif" }}
              >
                Loading...
              </motion.div>
            </div>
          ) : applications.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '40px 16px', gap: 12,
              background: 'rgba(255,255,255,0.025)',
              borderRadius: 12,
              border: '1px dashed rgba(240,180,60,0.15)',
            }}>
              <Briefcase size={28} color="rgba(240,180,60,0.25)" />
              <div style={{ fontSize: 12, color: 'rgba(200,220,210,0.4)', fontFamily: "'DM Sans', sans-serif", textAlign: 'center', lineHeight: 1.6 }}>
                No applications yet.<br />
                <span style={{ fontSize: 11, opacity: 0.7 }}>Say &ldquo;apply to internships&rdquo; to get started.</span>
              </div>
            </div>
          ) : (
            applications.map(app => (
              <div
                key={app.id}
                style={{
                  background: 'rgba(255,255,255,0.035)',
                  border: '1px solid rgba(240,180,60,0.12)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', gap: 10,
                  flexShrink: 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f0e8d0', fontFamily: "'DM Sans', sans-serif" }}>
                      {app.company}
                    </span>
                    <StatusSelect appId={app.id} status={app.status} onUpdate={handleStatusUpdate} />
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(200,220,210,0.6)', fontFamily: "'DM Sans', sans-serif", marginBottom: 3 }}>
                    {app.role_title}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(200,220,210,0.35)', fontFamily: "'DM Sans', sans-serif" }}>
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
                      color: 'rgba(240,200,100,0.45)',
                      display: 'flex', alignItems: 'center',
                      flexShrink: 0, marginTop: 2,
                      transition: 'color 0.15s', padding: 4, borderRadius: 6,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(240,200,100,0.85)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(240,200,100,0.45)'; }}
                  >
                    <ExternalLink size={13} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── RIGHT COLUMN: Tailored Resumes (narrower, flex 2) ── */}
        <div style={{
          flex: 2, overflowY: 'auto', padding: '20px 24px 20px 16px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'rgba(200,220,210,0.4)',
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: 4, flexShrink: 0,
          }}>
            Tailored Resumes
          </div>

          {applications.filter(app => app.tailored_resume_path).length === 0 ? (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 10,
              border: '1px dashed rgba(255,255,255,0.07)',
              padding: '28px 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <FileText size={22} color="rgba(200,220,210,0.2)" />
              <div style={{ fontSize: 11, color: 'rgba(200,220,210,0.3)', fontFamily: "'DM Sans', sans-serif", textAlign: 'center', lineHeight: 1.6 }}>
                Tailored resumes will appear here once the AI generates them.
              </div>
            </div>
          ) : (
            applications.filter(app => app.tailored_resume_path).map(app => (
              <div
                key={app.id}
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 8,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <FileText size={13} color="rgba(100,230,170,0.7)" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#f0e8d0', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {app.company}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(100,230,170,0.55)', fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>
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
                    background: 'rgba(80,200,150,0.1)',
                    border: '1px solid rgba(80,200,150,0.22)',
                    borderRadius: 6, padding: '2px 8px',
                    fontSize: 10, fontWeight: 500,
                    color: 'rgba(100,230,170,0.7)',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                    flexShrink: 0,
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
