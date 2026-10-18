import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  ExternalLink,
  Loader2,
  FileText,
  MessageSquare,
  Lock,
  Terminal,
  Check
} from 'lucide-react';
import {
  RedditScrubberService,
  RedditUserSession,
  ScrubItem,
  ScrubberStats,
  ScrubLogEntry
} from '../../services/scrubber';

interface AccountScrubberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurged?: () => void;
}

type ModalStep = 'init' | 'scanning' | 'ready' | 'scrubbing' | 'completed' | 'cancelled';

export const AccountScrubberModal: React.FC<AccountScrubberModalProps> = ({
  isOpen,
  onClose,
  onPurged
}) => {
  const [step, setStep] = useState<ModalStep>('init');
  const [session, setSession] = useState<RedditUserSession | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Scanned items
  const [items, setItems] = useState<ScrubItem[]>([]);
  const [scanCounts, setScanCounts] = useState({ comments: 0, posts: 0 });

  // Settings
  const [overwriteBeforeDelete, setOverwriteBeforeDelete] = useState(true);
  const [purgeExtensionData, setPurgeExtensionData] = useState(true);
  const [confirmInput, setConfirmInput] = useState('');

  // Execution state
  const [stats, setStats] = useState<ScrubberStats>({
    totalDiscovered: 0,
    totalComments: 0,
    totalPosts: 0,
    processedCount: 0,
    commentsDeleted: 0,
    postsDeleted: 0,
    failedCount: 0,
    retriedCount: 0
  });
  const [currentItem, setCurrentItem] = useState<ScrubItem | null>(null);
  const [logs, setLogs] = useState<ScrubLogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  // Refs for abortion and pause
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchSession = useCallback(async () => {
    setIsCheckingSession(true);
    setSessionError(null);
    try {
      const user = await RedditScrubberService.getCurrentUserSession();
      setSession(user);
      if (!user) {
        setSessionError('No active Reddit session detected. Please log into Reddit in your browser.');
      }
      // If session is refreshed during step === 'ready', reset to 'init' so items match active session
      setStep(prev => {
        if (prev === 'ready') {
          setItems([]);
          setScanCounts({ comments: 0, posts: 0 });
          setStats({
            totalDiscovered: 0,
            totalComments: 0,
            totalPosts: 0,
            processedCount: 0,
            commentsDeleted: 0,
            postsDeleted: 0,
            failedCount: 0,
            retriedCount: 0
          });
          return 'init';
        }
        return prev;
      });
    } catch {
      setSessionError('Could not verify Reddit session.');
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep('init');
      setConfirmInput('');
      setItems([]);
      setLogs([]);
      setIsPaused(false);
      setStats({
        totalDiscovered: 0,
        totalComments: 0,
        totalPosts: 0,
        processedCount: 0,
        commentsDeleted: 0,
        postsDeleted: 0,
        failedCount: 0,
        retriedCount: 0
      });
      setScanCounts({ comments: 0, posts: 0 });
      setCurrentItem(null);
      fetchSession();
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen, fetchSession]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (step !== 'scrubbing' && step !== 'scanning') {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, step, onClose]);

  if (!isOpen) return null;

  const handleCancelScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setScanCounts({ comments: 0, posts: 0 });
    setStep('init');
  };

  const handleStartScan = async () => {
    if (!session?.username) return;
    setSessionError(null);
    setScanCounts({ comments: 0, posts: 0 });
    setStep('scanning');
    setLogs([]);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const discovered = await RedditScrubberService.discoverAllUserItems(
        session.username,
        (count, type) => {
          setScanCounts(prev => ({
            ...prev,
            [type]: count
          }));
        },
        controller.signal
      );

      const allItems = [...discovered.comments, ...discovered.posts];
      setItems(allItems);
      setStats(prev => ({
        ...prev,
        totalDiscovered: allItems.length,
        totalComments: discovered.comments.length,
        totalPosts: discovered.posts.length
      }));
      setStep('ready');
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setSessionError(`Scanning failed: ${err?.message || 'Network error'}`);
        setStep('init');
      } else {
        setStep('init');
      }
    }
  };

  const handleStartScrub = async () => {
    if (confirmInput.trim().toUpperCase() !== 'DELETE') return;
    setSessionError(null);
    setStep('scrubbing');
    setIsPaused(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const finalStats = await RedditScrubberService.executeScrub(items, {
        overwriteBeforeDelete,
        purgeExtensionStorageOnFinish: purgeExtensionData,
        signal: controller.signal,
        shouldPause: () => isPausedRef.current,
        onProgress: (newStats, curItem) => {
          setStats({ ...newStats });
          setCurrentItem(curItem);
        },
        onLog: entry => {
          setLogs(prev => [...prev.slice(-100), entry]);
        }
      });

      setCurrentItem(null);
      setStats(finalStats);
      setStep('completed');
      if (purgeExtensionData) {
        onPurged?.();
      }
    } catch (err: any) {
      setCurrentItem(null);
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        setStep('cancelled');
      } else {
        setSessionError(`Scrubbing interrupted: ${err?.message || 'Error occurred'}`);
        setStep('ready');
      }
    }
  };

  const handleCancelScrub = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setCurrentItem(null);
    setIsPaused(false);
    setStep('cancelled');
  };

  const handleTogglePause = () => {
    setIsPaused(prev => !prev);
  };

  const progressPercent = stats.totalDiscovered > 0
    ? Math.min(100, Math.round((stats.processedCount / stats.totalDiscovered) * 100))
    : 0;

  return (
    <div
      className="rdg-modal-overlay animate-fade-in"
      style={{ zIndex: 1100 }}
      onClick={e => {
        // Prevent accidental clicks outside from closing during active scrubbing
        if (e.target === e.currentTarget && step !== 'scrubbing' && step !== 'scanning') {
          onClose();
        }
      }}
    >
      <div
        className="rdg-modal"
        style={{ maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rdg-scrubber-title"
      >
        {/* Modal Header */}
        <div className="rdg-card-header" style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--negative-dim)',
              border: '1.5px solid var(--negative-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--negative)'
            }}>
              <Trash2 size={14} />
            </div>
            <div>
              <h2 id="rdg-scrubber-title" style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                Reddit Profile & Data Eraser
              </h2>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Clean your profile before account deletion
              </span>
            </div>
          </div>
          {step !== 'scrubbing' && step !== 'scanning' && (
            <button
              type="button"
              onClick={onClose}
              className="rdg-btn-ghost"
              style={{ padding: 4 }}
              aria-label="Close dialog"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Important Privacy Notice Banner */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.06)',
            border: '1.5px solid var(--negative-border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10
          }}>
            <ShieldAlert size={18} style={{ color: 'var(--negative)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--negative)' }}>
                Why overwrite and delete before deleting your Reddit account?
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: 3 }}>
                When you delete a Reddit account, Reddit does <strong>not</strong> delete your post titles or comment text—it merely replaces the author name with <code>[deleted]</code>. This feature overwrites your content with privacy text and permanently deletes every post and comment, ensuring zero residual data remains on Reddit.
              </div>
            </div>
          </div>

          {/* User Session Status */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: session ? 'var(--royal-blue-dim)' : 'var(--bg-base)',
                border: '1.5px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: session ? 'var(--royal-blue)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: 13
              }}>
                {session?.username ? session.username.charAt(0).toUpperCase() : '?'}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {isCheckingSession
                    ? 'Checking Reddit session...'
                    : session
                    ? `u/${session.username}`
                    : 'Not logged in on Reddit'}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                  {session
                    ? `${session.totalKarma ?? 0} karma · Active session ready`
                    : 'Open reddit.com in a tab and sign in'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchSession}
              disabled={isCheckingSession || step === 'scrubbing'}
              className="rdg-btn rdg-btn-secondary"
              style={{ padding: '4px 8px', fontSize: 10 }}
              title="Refresh session"
            >
              <RotateCcw size={11} className={isCheckingSession ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {sessionError && (
            <div className="rdg-error" style={{ fontSize: 11, padding: '8px 10px' }}>
              <AlertTriangle size={14} />
              <span>{sessionError}</span>
            </div>
          )}

          {/* Step 1: Initial State */}
          {step === 'init' && session && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                background: '#ffffff',
                border: '1.5px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Cleanup Configuration
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={overwriteBeforeDelete}
                    onChange={e => setOverwriteBeforeDelete(e.target.checked)}
                    style={{ accentColor: 'var(--royal-blue)' }}
                  />
                  <span>
                    <strong>Overwrite text before deletion</strong> (Overwrites comment/post content first to defeat third-party caches and archives)
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={purgeExtensionData}
                    onChange={e => setPurgeExtensionData(e.target.checked)}
                    style={{ accentColor: 'var(--royal-blue)' }}
                  />
                  <span>
                    <strong>Purge all RedditDIG local data</strong> (Resets all extension storage, summaries, and settings to factory defaults)
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleStartScan}
                className="rdg-btn rdg-btn-primary"
                style={{ padding: '10px 14px', fontSize: 12, justifyContent: 'center' }}
              >
                <FileText size={14} />
                <span>Scan Profile For Posts & Comments</span>
              </button>
            </div>
          )}

          {/* Step 2: Scanning Profile */}
          {step === 'scanning' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              gap: 12,
              background: '#ffffff',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--border-default)'
            }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--royal-blue)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Discovering all posts & comments...
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Found {scanCounts.comments} comments and {scanCounts.posts} submissions so far
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelScan}
                className="rdg-btn rdg-btn-secondary"
                style={{ padding: '6px 14px', fontSize: 11, marginTop: 4 }}
              >
                <X size={12} />
                <span>Cancel Scan</span>
              </button>
            </div>
          )}

          {/* Step 3: Ready to Scrub Confirmation */}
          {step === 'ready' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                background: '#ffffff',
                border: '1.5px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Discovered Profile Content
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{
                    background: 'var(--bg-elevated)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-dim)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <MessageSquare size={12} />
                      <span>Comments</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: 2 }}>
                      {stats.totalComments}
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--bg-elevated)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-dim)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <FileText size={12} />
                      <span>Submitted Posts</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: 2 }}>
                      {stats.totalPosts}
                    </div>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div style={{ textAlign: 'center', margin: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      No posts or comments were found on this Reddit account.
                    </p>
                    {purgeExtensionData && (
                      <button
                        type="button"
                        onClick={async () => {
                          await RedditScrubberService.purgeAllExtensionData();
                          onPurged?.();
                          setStep('completed');
                        }}
                        className="rdg-btn rdg-btn-primary"
                        style={{ fontSize: 11, padding: '6px 14px' }}
                      >
                        <Trash2 size={12} />
                        <span>Purge Extension Storage Now</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid var(--negative-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px'
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--negative)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Lock size={12} />
                      <span>Safety Guardrail: Type "DELETE" to confirm</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                      This action permanently wipes all {items.length} items from Reddit and cannot be undone.
                    </div>
                    <input
                      type="text"
                      placeholder="Type DELETE to enable"
                      value={confirmInput}
                      onChange={e => setConfirmInput(e.target.value)}
                      className="rdg-input"
                      style={{
                        width: '100%',
                        marginTop: 8,
                        padding: '6px 10px',
                        fontSize: 12,
                        fontFamily: 'var(--font-mono)',
                        borderColor: confirmInput.trim().toUpperCase() === 'DELETE' ? 'var(--negative)' : 'var(--border-default)'
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setStep('init')}
                  className="rdg-btn rdg-btn-secondary"
                  style={{ flex: 1, padding: '8px 12px', fontSize: 11 }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleStartScrub}
                  disabled={confirmInput.trim().toUpperCase() !== 'DELETE' || items.length === 0}
                  className="rdg-btn"
                  style={{
                    flex: 2,
                    padding: '8px 14px',
                    fontSize: 11,
                    background: confirmInput.trim().toUpperCase() === 'DELETE' ? 'var(--negative)' : 'var(--bg-elevated)',
                    color: confirmInput.trim().toUpperCase() === 'DELETE' ? '#ffffff' : 'var(--text-muted)',
                    borderColor: 'var(--negative-border)',
                    cursor: confirmInput.trim().toUpperCase() === 'DELETE' ? 'pointer' : 'not-allowed',
                    justifyContent: 'center'
                  }}
                >
                  <Trash2 size={13} />
                  <span>Permanently Wipe Profile ({items.length} Items)</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Active Scrubbing Progress */}
          {step === 'scrubbing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                background: '#ffffff',
                border: '1.5px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {isPaused ? 'Scrubbing Paused' : 'Scrubbing in progress...'}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--royal-blue)' }}>
                    {progressPercent}%
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{
                  height: 6,
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  borderRadius: 3,
                  overflow: 'hidden',
                  border: '1px solid var(--border-dim)'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: 'var(--royal-blue)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <span>{stats.processedCount} of {stats.totalDiscovered} items</span>
                  <span>{stats.commentsDeleted} comments · {stats.postsDeleted} posts</span>
                </div>

                {currentItem && (
                  <div style={{
                    fontSize: 10.5,
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-elevated)',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-dim)'
                  }} className="rdg-line-clamp-2">
                    Current: <strong>{currentItem.fullName}</strong> in r/{currentItem.subreddit}
                  </div>
                )}

                {/* Controls */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="rdg-btn rdg-btn-secondary"
                    style={{ flex: 1, padding: '6px 10px', fontSize: 11, justifyContent: 'center' }}
                  >
                    {isPaused ? <Play size={12} /> : <Pause size={12} />}
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelScrub}
                    className="rdg-btn"
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      fontSize: 11,
                      background: 'var(--negative-dim)',
                      color: 'var(--negative)',
                      borderColor: 'var(--negative-border)',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={12} />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>

              {/* Terminal Log View */}
              <div style={{
                background: '#0f172a',
                color: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                padding: 10,
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                maxHeight: 140,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: 4 }}>
                  <Terminal size={11} />
                  <span>Activity Log</span>
                </div>
                {logs.map(log => (
                  <div key={log.id} style={{
                    color: log.type === 'error' ? '#f87171' : log.type === 'success' ? '#4ade80' : log.type === 'warn' ? '#fbbf24' : '#cbd5e1'
                  }}>
                    {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* Step 5: Completed */}
          {step === 'completed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                background: 'var(--positive-dim)',
                border: '1.5px solid var(--positive-border, rgba(16, 185, 129, 0.3))',
                borderRadius: 'var(--radius-md)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 8
              }}>
                <CheckCircle2 size={32} style={{ color: 'var(--positive)' }} />
                <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Profile Scrub Complete!
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Successfully deleted <strong>{stats.commentsDeleted}</strong> comments and <strong>{stats.postsDeleted}</strong> posts from Reddit.
                  {purgeExtensionData && ' Local extension storage has been completely purged.'}
                </div>
              </div>

              {/* Final Account Deactivation Guidance */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Ready to delete your Reddit account
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Your profile history is now completely clean. You can now deactivate your account without any concern of comments or posts lingering on Reddit.
                </div>
                <a
                  href="https://www.reddit.com/settings/account"
                  target="_blank"
                  rel="noreferrer"
                  className="rdg-btn rdg-btn-primary"
                  style={{
                    padding: '8px 12px',
                    fontSize: 11,
                    textDecoration: 'none',
                    justifyContent: 'center',
                    marginTop: 4
                  }}
                >
                  <span>Open Reddit Account Settings</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rdg-btn rdg-btn-secondary"
                style={{ width: '100%', padding: '8px 12px', fontSize: 11, justifyContent: 'center' }}
              >
                <Check size={12} />
                <span>Finished & Close</span>
              </button>
            </div>
          )}

          {/* Cancelled State */}
          {step === 'cancelled' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center', padding: 16 }}>
              <AlertTriangle size={28} style={{ color: 'var(--warning)', margin: '0 auto' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Scrubbing Cancelled
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Processed {stats.processedCount} items before cancellation ({stats.commentsDeleted} comments, {stats.postsDeleted} posts deleted).
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmInput('');
                    setStep('init');
                  }}
                  className="rdg-btn rdg-btn-secondary"
                  style={{ padding: '6px 14px', fontSize: 11 }}
                >
                  Start Over
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rdg-btn rdg-btn-ghost"
                  style={{ padding: '6px 14px', fontSize: 11 }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
