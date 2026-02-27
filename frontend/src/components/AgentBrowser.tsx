import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';

interface AgentBrowserProps {
  navigateRef?: React.MutableRefObject<((url: string) => void) | null>;
  forceUpdateRef?: React.MutableRefObject<(() => void) | null>;
}

export function AgentBrowser({ navigateRef, forceUpdateRef }: AgentBrowserProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputUrl, setInputUrl] = useState('https://www.google.com');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Safely get electron ipcRenderer (won't crash in standard browser)
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

  // Expose a method to force-resend current bounds (used to restore browser after overlay hides it)
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

  // Report dimension changes to main.js so WebContentsView can track this div's bounds perfectly
  useEffect(() => {
    if (!ipcRenderer || !containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        ipcRenderer.send('update-browser-bounds', {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
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
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(6,12,12,0.6)',
      boxShadow: 'inset 0 0 0 1.5px rgba(240,180,60,0.3)',
      overflow: 'hidden',
    }}>
      {/* URL Bar */}
      <div style={{
        height: 48,
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(0,0,0,0.45)',
        borderBottom: '1px solid rgba(240,180,60,0.2)',
        boxShadow: 'inset 14px 0 28px rgba(0,0,0,0.5)',
        flexShrink: 0,
        position: 'relative',

        // This prevents WebContentsView clicks from passing through empty UI regions
        ...({ WebkitAppRegion: 'no-drag' } as any)
      }}>
        <button onClick={() => ipcRenderer?.send('browser-go-back')} disabled={!canGoBack} style={{
          background: 'transparent', border: 'none',
          cursor: canGoBack ? 'pointer' : 'default',
          color: canGoBack ? 'rgba(255,240,170,0.7)' : 'rgba(255,240,170,0.2)',
          width: 28, height: 28, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <ChevronLeft size={16} />
        </button>

        <button onClick={() => ipcRenderer?.send('browser-go-forward')} disabled={!canGoForward} style={{
          background: 'transparent', border: 'none',
          cursor: canGoForward ? 'pointer' : 'default',
          color: canGoForward ? 'rgba(255,240,170,0.7)' : 'rgba(255,240,170,0.2)',
          width: 28, height: 28, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <ChevronRight size={16} />
        </button>

        <button onClick={() => ipcRenderer?.send(isLoading ? 'browser-stop' : 'browser-reload')} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'rgba(255,240,170,0.5)',
          width: 28, height: 28, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {isLoading ? <X size={14} /> : <RotateCcw size={14} />}
        </button>

        <button
          onClick={() => navigate('https://carmen.osu.edu')}
          title="Go to Carmen"
          style={{
            background: 'rgba(240,180,60,0.1)',
            border: '1px solid rgba(240,180,60,0.22)',
            borderRadius: 6, padding: '3px 8px',
            fontSize: 10, color: 'rgba(240,200,100,0.7)',
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500, letterSpacing: '0.04em',
            flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >
          Carmen
        </button>

        <input
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && navigate(inputUrl)}
          onFocus={e => e.target.select()}
          placeholder="Enter URL..."
          style={{
            flex: 1, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
            padding: '5px 10px', fontSize: 12, color: '#f0e8d0',
            outline: 'none', fontFamily: "'DM Sans', sans-serif",
          }}
        />

        {isLoading && (
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 8, ease: 'linear' }}
            style={{
              position: 'absolute', bottom: 0, left: 0,
              height: 2, width: '100%',
              background: 'linear-gradient(90deg, #f0c050, #d4a030)',
              transformOrigin: 'left',
            }}
          />
        )}
      </div>

      {/* Container holding the transparent region where the separate WebContentsView will appear backing this React UI */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', background: 'transparent' }}>
      </div>
    </div>
  );
}
