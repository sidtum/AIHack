import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface AgentBrowserProps {
  navigateRef?: React.MutableRefObject<((url: string) => void) | null>;
  forceUpdateRef?: React.MutableRefObject<(() => void) | null>;
}

const C = {
  bg: '#0E1522',
  barBg: 'rgba(10, 15, 28, 0.92)',
  accent: '#D4AF6C',
  teal: '#89CEC2',
  textPrimary: '#F5EDD8',
  textDim: 'rgba(245, 237, 216, 0.35)',
  borderGold: 'rgba(212, 175, 108, 0.12)',
  borderGlass: 'rgba(245, 237, 216, 0.07)',
};

function NavBtn({
  onClick,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: h && !disabled ? 'rgba(212, 175, 108, 0.08)' : 'transparent',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'rgba(245, 237, 216, 0.18)' : h ? C.accent : 'rgba(245, 237, 216, 0.45)',
        width: 30, height: 30, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s', flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function QuickChip({
  label,
  onClick,
  color,
}: {
  label: string;
  onClick: () => void;
  color: string;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: h ? `rgba(${color}, 0.15)` : `rgba(${color}, 0.07)`,
        border: `1px solid rgba(${color}, ${h ? '0.3' : '0.18'})`,
        borderRadius: 6, padding: '3px 9px',
        fontSize: 10, color: `rgba(${color}, ${h ? '0.9' : '0.65'})`,
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500, letterSpacing: '0.08em',
        flexShrink: 0, whiteSpace: 'nowrap',
        textTransform: 'uppercase',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

export function AgentBrowser({ navigateRef, forceUpdateRef }: AgentBrowserProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputUrl, setInputUrl] = useState('https://www.google.com');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [urlFocused, setUrlFocused] = useState(false);

  const ipcRenderer = typeof window !== 'undefined' ? (window as any).require?.('electron')?.ipcRenderer : null;

  // Wire up main process events
  useEffect(() => {
    if (!ipcRenderer) return;
    const onNavUpdate = (_: any, data: any) => {
      setInputUrl(data.url);
      setCanGoBack(data.canGoBack);
      setCanGoForward(data.canGoForward);
    };
    const onLoadingStart = () => setIsLoading(true);
    const onLoadingStop = () => setIsLoading(false);
    ipcRenderer.on('browser-nav-update', onNavUpdate);
    ipcRenderer.on('browser-loading-start', onLoadingStart);
    ipcRenderer.on('browser-loading-stop', onLoadingStop);
    return () => {
      ipcRenderer.removeListener('browser-nav-update', onNavUpdate);
      ipcRenderer.removeListener('browser-loading-start', onLoadingStart);
      ipcRenderer.removeListener('browser-loading-stop', onLoadingStop);
    };
  }, [ipcRenderer]);

  // Expose navigate via ref
  useEffect(() => {
    if (navigateRef) {
      navigateRef.current = (url: string) => ipcRenderer?.send('browser-navigate', url);
    }
    return () => { if (navigateRef) navigateRef.current = null; };
  }, [navigateRef, ipcRenderer]);

  // Expose force-resend bounds
  useEffect(() => {
    if (!forceUpdateRef) return;
    forceUpdateRef.current = () => {
      if (!containerRef.current || !ipcRenderer) return;
      const rect = containerRef.current.getBoundingClientRect();
      ipcRenderer.send('update-browser-bounds', {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };
    return () => { if (forceUpdateRef) forceUpdateRef.current = null; };
  }, [forceUpdateRef, ipcRenderer]);

  // Report dimension changes
  useEffect(() => {
    if (!ipcRenderer || !containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        ipcRenderer.send('update-browser-bounds', {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [ipcRenderer]);

  const navigate = (url: string) => {
    let target = url.trim();
    if (!target) return;
    if (!target.startsWith('http://') && !target.startsWith('https://') && target !== 'about:blank') {
      target = 'https://' + target;
    }
    ipcRenderer?.send('browser-navigate', target);
  };

  return (
    <div style={{
      flex: 1, minHeight: 0, minWidth: 0,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(8, 12, 22, 0.7)',
      overflow: 'hidden',
    }}>
      {/* ── URL / NAV BAR ── */}
      <div style={{
        height: 46,
        padding: '0 10px',
        display: 'flex', alignItems: 'center', gap: 6,
        background: C.barBg,
        borderBottom: `1px solid ${C.borderGold}`,
        backdropFilter: 'blur(20px)',
        flexShrink: 0,
        position: 'relative',
        ...({ WebkitAppRegion: 'no-drag' } as any),
      }}>
        {/* Back / Forward / Reload */}
        <NavBtn onClick={() => ipcRenderer?.send('browser-go-back')} disabled={!canGoBack} title="Back">
          <ChevronLeft size={15} />
        </NavBtn>
        <NavBtn onClick={() => ipcRenderer?.send('browser-go-forward')} disabled={!canGoForward} title="Forward">
          <ChevronRight size={15} />
        </NavBtn>
        <NavBtn onClick={() => ipcRenderer?.send(isLoading ? 'browser-stop' : 'browser-reload')} title={isLoading ? 'Stop' : 'Reload'}>
          {isLoading
            ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}><RotateCcw size={13} /></motion.div>
            : <RotateCcw size={13} />}
        </NavBtn>

        {/* Thin separator */}
        <div style={{ width: 1, height: 16, background: C.borderGold, flexShrink: 0 }} />

        {/* Quick nav chips */}
        <QuickChip label="Carmen" onClick={() => navigate('https://carmen.osu.edu')} color="212, 175, 108" />

        {/* URL input */}
        <motion.div
          animate={{
            boxShadow: urlFocused
              ? '0 0 0 1.5px rgba(212, 175, 108, 0.25), 0 2px 12px rgba(0,0,0,0.3)'
              : 'none',
          }}
          style={{
            flex: 1,
            borderRadius: 10,
            border: `1px solid ${urlFocused ? 'rgba(212, 175, 108, 0.25)' : C.borderGlass}`,
            background: urlFocused ? 'rgba(26, 34, 56, 0.8)' : 'rgba(245, 237, 216, 0.04)',
            transition: 'border-color 0.2s, background 0.2s',
            overflow: 'hidden',
          }}
        >
          <input
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && navigate(inputUrl)}
            onFocus={e => { setUrlFocused(true); e.target.select(); }}
            onBlur={() => setUrlFocused(false)}
            placeholder="Enter URL or search…"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none', outline: 'none',
              padding: '6px 12px',
              fontSize: 12,
              color: urlFocused ? C.textPrimary : 'rgba(245, 237, 216, 0.5)',
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.01em',
            }}
          />
        </motion.div>

        {/* Loading progress bar */}
        {isLoading && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 8, ease: 'linear' }}
            style={{
              position: 'absolute', bottom: 0, left: 0,
              height: 1.5, width: '100%',
              background: `linear-gradient(90deg, transparent 0%, ${C.accent} 40%, #E8C97E 100%)`,
              transformOrigin: 'left',
            }}
          />
        )}
      </div>

      {/* WebContentsView container — transparent region */}
      <div ref={containerRef} style={{
        flex: 1, minHeight: 0, position: 'relative',
        display: 'flex', background: 'transparent',
      }} />
    </div>
  );
}
