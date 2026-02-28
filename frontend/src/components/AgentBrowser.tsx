import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCcw, X, Plus, Globe } from 'lucide-react';

interface Tab {
  id: number;
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface AgentBrowserProps {
  navigateRef?: React.MutableRefObject<((url: string) => void) | null>;
  forceUpdateRef?: React.MutableRefObject<(() => void) | null>;
  onOpenCareerDashboard?: () => void;
  onOpenNotesDashboard?: () => void;
}

export function AgentBrowser({ navigateRef, forceUpdateRef, onOpenCareerDashboard, onOpenNotesDashboard }: AgentBrowserProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [inputUrl, setInputUrl] = useState('https://www.google.com');
  const [hoveredTab, setHoveredTab] = useState<number | null>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);

  const ipcRenderer = typeof window !== 'undefined' ? (window as any).require?.('electron')?.ipcRenderer : null;

  // ─── Sync tab state from Electron main process on mount ────────────────────
  useEffect(() => {
    if (!ipcRenderer) return;

    ipcRenderer.invoke('get-tabs').then((snapshot: any) => {
      if (snapshot && snapshot.tabs && snapshot.tabs.length > 0) {
        setTabs(snapshot.tabs.map((t: any) => ({
          id: t.id,
          url: t.url,
          title: t.title || 'New Tab',
          isLoading: false,
          canGoBack: false,
          canGoForward: false,
        })));
        setActiveTabId(snapshot.activeTabId);
        const active = snapshot.tabs.find((t: any) => t.id === snapshot.activeTabId);
        if (active) setInputUrl(active.url);
      } else {
        ipcRenderer.send('create-tab', 'https://www.google.com');
      }
    }).catch(() => {
      setTabs([{ id: 1, url: 'https://www.google.com', title: 'New Tab', isLoading: false, canGoBack: false, canGoForward: false }]);
      setActiveTabId(1);
    });
  }, [ipcRenderer]);

  // ─── IPC listeners for tab events ──────────────────────────────────────────
  useEffect(() => {
    if (!ipcRenderer) return;

    const onTabNavUpdate = (_: any, data: any) => {
      setTabs(prev => prev.map(t =>
        t.id === data.tabId
          ? { ...t, url: data.url, title: data.title || data.url, canGoBack: data.canGoBack, canGoForward: data.canGoForward }
          : t
      ));
      setActiveTabId(current => {
        if (data.tabId === current) setInputUrl(data.url);
        return current;
      });
    };

    const onTabLoading = (_: any, data: any) => {
      setTabs(prev => prev.map(t =>
        t.id === data.tabId ? { ...t, isLoading: data.loading } : t
      ));
    };

    const onTabTitleUpdated = (_: any, data: any) => {
      setTabs(prev => prev.map(t =>
        t.id === data.tabId ? { ...t, title: data.title } : t
      ));
    };

    const onTabCreated = (_: any, data: any) => {
      setTabs(prev => {
        if (prev.some(t => t.id === data.tabId)) return prev;
        return [...prev, { id: data.tabId, url: data.url, title: data.title || 'New Tab', isLoading: false, canGoBack: false, canGoForward: false }];
      });
      setActiveTabId(data.tabId);
      setInputUrl(data.url);
    };

    const onTabClosed = (_: any, data: any) => {
      setTabs(prev => prev.filter(t => t.id !== data.tabId));
      if (data.activeTabId) setActiveTabId(data.activeTabId);
    };

    // Legacy single-tab events (backward compat with backend browser_navigate)
    const onNavUpdate = (_: any, data: any) => {
      setActiveTabId(current => {
        setTabs(prev => prev.map(t =>
          t.id === current ? { ...t, url: data.url, canGoBack: data.canGoBack, canGoForward: data.canGoForward } : t
        ));
        setInputUrl(data.url);
        return current;
      });
    };
    const onLoadingStart = () => {
      setActiveTabId(current => {
        setTabs(prev => prev.map(t => t.id === current ? { ...t, isLoading: true } : t));
        return current;
      });
    };
    const onLoadingStop = () => {
      setActiveTabId(current => {
        setTabs(prev => prev.map(t => t.id === current ? { ...t, isLoading: false } : t));
        return current;
      });
    };

    ipcRenderer.on('tab-nav-update', onTabNavUpdate);
    ipcRenderer.on('tab-loading', onTabLoading);
    ipcRenderer.on('tab-title-updated', onTabTitleUpdated);
    ipcRenderer.on('tab-created', onTabCreated);
    ipcRenderer.on('tab-closed', onTabClosed);
    ipcRenderer.on('browser-nav-update', onNavUpdate);
    ipcRenderer.on('browser-loading-start', onLoadingStart);
    ipcRenderer.on('browser-loading-stop', onLoadingStop);

    return () => {
      ipcRenderer.removeListener('tab-nav-update', onTabNavUpdate);
      ipcRenderer.removeListener('tab-loading', onTabLoading);
      ipcRenderer.removeListener('tab-title-updated', onTabTitleUpdated);
      ipcRenderer.removeListener('tab-created', onTabCreated);
      ipcRenderer.removeListener('tab-closed', onTabClosed);
      ipcRenderer.removeListener('browser-nav-update', onNavUpdate);
      ipcRenderer.removeListener('browser-loading-start', onLoadingStart);
      ipcRenderer.removeListener('browser-loading-stop', onLoadingStop);
    };
  }, [ipcRenderer]);

  useEffect(() => {
    if (activeTab) setInputUrl(activeTab.url);
  }, [activeTabId]);

  useEffect(() => {
    if (navigateRef) {
      navigateRef.current = (url: string) => ipcRenderer?.send('browser-navigate', url);
    }
    return () => { if (navigateRef) navigateRef.current = null; };
  }, [navigateRef, ipcRenderer]);

  useEffect(() => {
    if (!forceUpdateRef) return;
    forceUpdateRef.current = () => {
      if (!containerRef.current || !ipcRenderer) return;
      const rect = containerRef.current.getBoundingClientRect();
      ipcRenderer.send('update-browser-bounds', {
        x: Math.round(rect.x), y: Math.round(rect.y),
        width: Math.round(rect.width), height: Math.round(rect.height),
      });
    };
    return () => { if (forceUpdateRef) forceUpdateRef.current = null; };
  }, [forceUpdateRef, ipcRenderer]);

  useEffect(() => {
    if (!ipcRenderer || !containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        ipcRenderer.send('update-browser-bounds', {
          x: Math.round(rect.x), y: Math.round(rect.y),
          width: Math.round(rect.width), height: Math.round(rect.height)
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [ipcRenderer]);

  const navigate = useCallback((url: string) => {
    let target = url.trim();
    if (!target) return;
    if (!target.startsWith('http://') && !target.startsWith('https://') && target !== 'about:blank') {
      target = 'https://' + target;
    }
    ipcRenderer?.send('browser-navigate', target);
  }, [ipcRenderer]);

  const handleNewTab = useCallback(() => {
    ipcRenderer?.send('create-tab', 'https://www.google.com');
  }, [ipcRenderer]);

  const handleCloseTab = useCallback((tabId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      if (prev.length <= 1) return prev;
      ipcRenderer?.send('close-tab', tabId);
      const remaining = prev.filter(t => t.id !== tabId);
      setActiveTabId(current => {
        if (current === tabId && remaining.length > 0) {
          const idx = prev.findIndex(t => t.id === tabId);
          const nextTab = remaining[Math.min(idx, remaining.length - 1)];
          ipcRenderer?.send('switch-tab', nextTab.id);
          setInputUrl(nextTab.url);
          return nextTab.id;
        }
        return current;
      });
      return remaining;
    });
  }, [ipcRenderer]);

  const handleSwitchTab = useCallback((tabId: number) => {
    setActiveTabId(current => {
      if (tabId === current) return current;
      ipcRenderer?.send('switch-tab', tabId);
      return tabId;
    });
  }, [ipcRenderer]);

  const truncateTitle = (title: string, maxLen: number = 18) => {
    if (title.length <= maxLen) return title;
    return title.slice(0, maxLen) + '\u2026';
  };

  return (
    <div style={{
      flex: 1, minHeight: 0, minWidth: 0,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(6,12,12,0.6)',
      boxShadow: 'inset 0 0 0 1.5px rgba(240,180,60,0.3)',
      overflow: 'hidden',
    }}>
      {/* Tab Bar */}
      <div style={{
        height: 36, padding: '4px 8px 0',
        display: 'flex', alignItems: 'flex-end', gap: 1,
        background: 'rgba(0,0,0,0.55)',
        borderBottom: '1px solid rgba(240,180,60,0.12)',
        flexShrink: 0, overflow: 'hidden',
        ...({ WebkitAppRegion: 'no-drag' } as any),
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <AnimatePresence initial={false}>
            {tabs.map(tab => {
              const isActive = tab.id === activeTabId;
              const isHovered = hoveredTab === tab.id;
              return (
                <motion.div
                  key={tab.id} layout
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: 'auto' }}
                  exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  onClick={() => handleSwitchTab(tab.id)}
                  onMouseEnter={() => setHoveredTab(tab.id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', minWidth: 60, maxWidth: 180, height: 30,
                    borderRadius: '8px 8px 0 0', cursor: 'pointer', userSelect: 'none',
                    position: 'relative',
                    background: isActive ? 'rgba(255,255,255,0.08)' : isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                    borderTop: isActive ? '1px solid rgba(240,180,60,0.3)' : '1px solid transparent',
                    borderLeft: isActive ? '1px solid rgba(240,180,60,0.15)' : '1px solid transparent',
                    borderRight: isActive ? '1px solid rgba(240,180,60,0.15)' : '1px solid transparent',
                    transition: 'background 0.15s', flexShrink: 1, overflow: 'hidden',
                  }}
                >
                  {tab.isLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ flexShrink: 0 }}>
                      <RotateCcw size={10} style={{ color: 'rgba(240,180,60,0.6)' }} />
                    </motion.div>
                  ) : (
                    <Globe size={10} style={{ color: isActive ? 'rgba(240,200,100,0.6)' : 'rgba(255,240,170,0.25)', flexShrink: 0 }} />
                  )}
                  <span style={{
                    fontSize: 11, fontFamily: "'DM Sans', sans-serif",
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? 'rgba(255,240,200,0.85)' : 'rgba(255,240,170,0.45)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0,
                  }}>
                    {truncateTitle(tab.title)}
                  </span>
                  {(isActive || isHovered) && tabs.length > 1 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
                      onClick={(e) => handleCloseTab(tab.id, e)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'rgba(255,240,170,0.35)', width: 16, height: 16, borderRadius: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, padding: 0, transition: 'color 0.15s, background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,100,100,0.8)'; e.currentTarget.style.background = 'rgba(255,100,100,0.12)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,240,170,0.35)'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <X size={9} />
                    </motion.button>
                  )}
                  {isActive && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'rgba(0,0,0,0.55)' }} />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          <button
            onClick={handleNewTab}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'rgba(255,240,170,0.3)', width: 26, height: 26, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginBottom: 2, transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,240,170,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,240,170,0.3)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* URL Bar */}
      <div style={{
        height: 40, padding: '0 10px',
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'rgba(0,0,0,0.35)',
        borderBottom: '1px solid rgba(240,180,60,0.2)',
        flexShrink: 0, position: 'relative',
        ...({ WebkitAppRegion: 'no-drag' } as any)
      }}>
        <button onClick={() => ipcRenderer?.send('browser-go-back')} disabled={!activeTab?.canGoBack} style={{
          background: 'transparent', border: 'none',
          cursor: activeTab?.canGoBack ? 'pointer' : 'default',
          color: activeTab?.canGoBack ? 'rgba(255,240,170,0.7)' : 'rgba(255,240,170,0.2)',
          width: 28, height: 28, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <ChevronLeft size={16} />
        </button>

        <button onClick={() => ipcRenderer?.send('browser-go-forward')} disabled={!activeTab?.canGoForward} style={{
          background: 'transparent', border: 'none',
          cursor: activeTab?.canGoForward ? 'pointer' : 'default',
          color: activeTab?.canGoForward ? 'rgba(255,240,170,0.7)' : 'rgba(255,240,170,0.2)',
          width: 28, height: 28, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <ChevronRight size={16} />
        </button>

        <button onClick={() => ipcRenderer?.send(activeTab?.isLoading ? 'browser-stop' : 'browser-reload')} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'rgba(255,240,170,0.5)',
          width: 28, height: 28, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {activeTab?.isLoading ? <X size={14} /> : <RotateCcw size={14} />}
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
            fontWeight: 500, letterSpacing: '0.08em',
            flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'uppercase',
          }}
        >
          Carmen
        </button>

        <button
          onClick={onOpenCareerDashboard}
          title="Open Career Dashboard"
          style={{
            background: 'rgba(80,200,150,0.08)',
            border: '1px solid rgba(80,200,150,0.22)',
            borderRadius: 6, padding: '3px 8px',
            fontSize: 10, color: 'rgba(100,230,170,0.7)',
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500, letterSpacing: '0.08em',
            flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'uppercase',
          }}
        >
          Career
        </button>

        <button
          onClick={onOpenNotesDashboard}
          title="Open Notes Dashboard"
          style={{
            background: 'rgba(150,100,255,0.08)',
            border: '1px solid rgba(150,100,255,0.22)',
            borderRadius: 6, padding: '3px 8px',
            fontSize: 10, color: 'rgba(180,140,255,0.8)',
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500, letterSpacing: '0.08em',
            flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'uppercase',
          }}
        >
          Notes
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

        {activeTab?.isLoading && (
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

      {/* Container for the WebContentsView */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', background: 'transparent' }}>
      </div>
    </div>
  );
}
