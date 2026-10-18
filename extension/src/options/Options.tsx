import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  RefreshCw,
  ExternalLink,
  Keyboard,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import { StorageService, AppSettings, DEFAULT_SETTINGS, clampCommentLimit } from '../services/storage';
import { AccountScrubberModal } from '../components/scrubber/AccountScrubberModal';
import { MainLogo } from '../components/common/MainLogo';

export const Options: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [commentInputStr, setCommentInputStr] = useState<string>(String(DEFAULT_SETTINGS.maxComments));
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showScrubber, setShowScrubber] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    StorageService.getSettings().then(s => {
      if (cancelled) return;
      setSettings(s);
      setCommentInputStr(String(s.maxComments));
    });
    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const commitCommentLimit = (rawValue: string | number) => {
    const clamped = clampCommentLimit(rawValue);
    setSettings(prev => ({ ...prev, maxComments: clamped }));
    setCommentInputStr(String(clamped));
  };

  const handleSave = async () => {
    const finalSettings = { ...settings, maxComments: clampCommentLimit(commentInputStr) };
    setErrorMessage(null);
    try {
      await StorageService.saveSettings(finalSettings);
    } catch (e) {
      console.warn('RedditDIG: could not save settings:', e);
      setErrorMessage('Settings could not be saved. Please try again.');
      return;
    }
    setSaveSuccess(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveSuccess(false);
    }, 2500);
  };

  const handleResetSettings = async () => {
    if (!confirm('Reset all settings to default configuration?')) return;
    setErrorMessage(null);
    try {
      await StorageService.clearAllData();
    } catch {
      setErrorMessage('Settings could not be reset. Please try again.');
      return;
    }
    setSettings({ ...DEFAULT_SETTINGS });
    setCommentInputStr(String(DEFAULT_SETTINGS.maxComments));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-root)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Top Header */}
        <header style={{
          background: 'var(--bg-surface)',
          padding: '16px 20px',
          borderRadius: 'var(--radius-lg)',
          border: '1.5px solid var(--border-default)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MainLogo size={28} />
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                Reddit<span style={{ color: 'var(--royal-blue)' }}>DIG</span>
              </h1>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Preferences & Extension Configuration</span>
            </div>
          </div>
          <a
            href="https://www.reddit.com"
            target="_blank"
            rel="noreferrer"
            className="rdg-btn rdg-btn-secondary"
            style={{ fontSize: 11, padding: '6px 12px' }}
          >
            <span>Open Reddit</span>
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        </header>

        {/* 100% Local & Privacy Banner */}
        <div style={{
          background: 'var(--positive-dim)',
          border: '1.5px solid var(--positive-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12
        }}>
          <ShieldCheck size={20} style={{ color: 'var(--positive)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--positive)' }}>
              100% Local Discussion Engine
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 2 }}>
              RedditDIG runs entirely inside your browser's extension sandbox with zero remote telemetry, zero external LLMs, and zero data storage on cloud servers. Thread content is read directly from your browser's active tab and never leaves your machine.
            </div>
          </div>
        </div>

        {/* Core Settings Card */}
        <main className="rdg-card">
          <div className="rdg-card-header" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={14} style={{ color: 'var(--royal-blue)' }} />
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                Analysis & Search Settings
              </h2>
            </div>
          </div>

          <div className="rdg-card-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Comment Reading Limit */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="rdg-filter-label" htmlFor="opt-max-comments" style={{ marginBottom: 0, fontSize: 12 }}>
                  Comments to Read Per Post
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    id="opt-max-comments"
                    type="number"
                    min={50}
                    max={10000}
                    step={50}
                    value={commentInputStr}
                    onChange={e => {
                      const str = e.target.value;
                      setCommentInputStr(str);
                      const num = Number(str);
                      if (!isNaN(num) && num >= 50 && num <= 10000) {
                        setSettings(prev => ({ ...prev, maxComments: num }));
                      }
                    }}
                    onBlur={() => commitCommentLimit(commentInputStr)}
                    className="rdg-input"
                    style={{
                      width: 80,
                      padding: '4px 8px',
                      fontSize: 12,
                      textAlign: 'right',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--royal-blue)',
                      border: '1.5px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  />
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>comments</span>
                </div>
              </div>

              {/* Quick preset buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[500, 1000, 2500, 5000, 10000].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => {
                      setSettings(prev => ({ ...prev, maxComments: cnt }));
                      setCommentInputStr(String(cnt));
                    }}
                    className={`rdg-btn ${settings.maxComments === cnt ? 'rdg-btn-primary' : 'rdg-btn-secondary'}`}
                    style={{
                      flex: 1,
                      minWidth: 64,
                      padding: '5px 8px',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: settings.maxComments === cnt ? 700 : 500
                    }}
                  >
                    {cnt >= 1000 ? `${cnt / 1000}k` : cnt}
                  </button>
                ))}
              </div>

              <input
                type="range"
                aria-label="Comments to read (slider)"
                min={100}
                max={10000}
                step={100}
                value={settings.maxComments}
                onChange={e => {
                  const val = Number(e.target.value);
                  setSettings(prev => ({ ...prev, maxComments: val }));
                  setCommentInputStr(String(val));
                }}
                style={{ width: '100%', accentColor: 'var(--royal-blue)', cursor: 'pointer', margin: '6px 0' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>100 (Quick glance)</span>
                <span>1k (Standard)</span>
                <span>5k (Deep dive)</span>
                <span>10k (Maximum coverage)</span>
              </div>
            </div>

            {/* Smart Meaning Search Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: '#ffffff',
              border: '1.5px solid var(--border-default)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>Smart Meaning Search</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Find comments by semantic intent and subword similarity in local memory</div>
              </div>
              <input
                type="checkbox"
                aria-label="Smart Meaning Search"
                checked={settings.similaritySearchEnabled}
                onChange={e => setSettings({ ...settings, similaritySearchEnabled: e.target.checked })}
                style={{ accentColor: 'var(--royal-blue)', width: 18, height: 18, cursor: 'pointer' }}
              />
            </div>

            {/* Auto-Read on Open Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: '#ffffff',
              border: '1.5px solid var(--border-default)',
              borderRadius: 'var(--radius-md)'
            }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>Auto-Read on Open</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Automatically start analyzing discussion whenever you open the side panel on a post</div>
              </div>
              <input
                type="checkbox"
                aria-label="Auto-Read on Open"
                checked={settings.autoAnalysis}
                onChange={e => setSettings({ ...settings, autoAnalysis: e.target.checked })}
                style={{ accentColor: 'var(--royal-blue)', width: 18, height: 18, cursor: 'pointer' }}
              />
            </div>

            {errorMessage && (
              <div className="rdg-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderTop: '1.5px solid var(--border-default)',
            background: 'var(--bg-elevated)'
          }}>
            <button
              type="button"
              onClick={handleResetSettings}
              className="rdg-btn rdg-btn-secondary"
              style={{ fontSize: 11, padding: '7px 12px' }}
            >
              <RefreshCw size={12} aria-hidden="true" />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="rdg-btn rdg-btn-primary"
              style={{ fontSize: 12, padding: '8px 20px' }}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 size={13} aria-hidden="true" />
                  <span>Settings Saved!</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </main>

        {/* Profile & Account Wiper Section */}
        <section className="rdg-card" style={{ borderColor: 'var(--negative-border)' }}>
          <div className="rdg-card-header" style={{ padding: '12px 16px', borderBottomColor: 'var(--negative-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={14} style={{ color: 'var(--negative)' }} />
              <h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: 'var(--negative)' }}>
                Profile & Account Data Scrubber
              </h2>
            </div>
          </div>
          <div className="rdg-card-body" style={{ padding: 18 }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
              Permanently overwrite and delete every submission and comment from your Reddit profile before closing your account. Reddit does not delete post titles or comment text when deleting an account—this wiper ensures zero residual personal data is retained.
            </p>
            <button
              type="button"
              onClick={() => setShowScrubber(true)}
              className="rdg-btn"
              style={{
                background: 'var(--negative-dim)',
                color: 'var(--negative)',
                borderColor: 'var(--negative-border)',
                padding: '9px 16px',
                fontSize: 12,
                fontWeight: 700
              }}
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>Launch Profile & Account Wiper</span>
            </button>
          </div>
        </section>

        {/* Keyboard Shortcut Information */}
        <footer style={{
          background: 'var(--bg-surface)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-lg)',
          border: '1.5px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Keyboard size={14} style={{ color: 'var(--royal-blue)' }} aria-hidden="true" />
            <span>Side Panel Shortcut:</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            <span className="redditdig-kbd">{isMac ? 'Cmd' : 'Ctrl'}</span>
            <span>+</span>
            <span className="redditdig-kbd">Shift</span>
            <span>+</span>
            <span className="redditdig-kbd">L</span>
          </div>
        </footer>
      </div>

      <AccountScrubberModal
        isOpen={showScrubber}
        onClose={() => setShowScrubber(false)}
        onPurged={() => {
          setSettings({ ...DEFAULT_SETTINGS });
          setCommentInputStr(String(DEFAULT_SETTINGS.maxComments));
        }}
      />
    </div>
  );
};
