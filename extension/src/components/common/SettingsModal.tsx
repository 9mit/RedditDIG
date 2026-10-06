import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, ShieldCheck, RefreshCw, Trash2, Sliders, AlertCircle } from 'lucide-react';
import { StorageService, AppSettings, DEFAULT_SETTINGS, clampCommentLimit } from '../../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onClearSession?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved, onClearSession }) => {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [commentInputStr, setCommentInputStr] = useState<string>(String(DEFAULT_SETTINGS.maxComments));
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    StorageService.getSettings().then(s => {
      if (cancelled) return;
      setSettings(s);
      setCommentInputStr(String(s.maxComments));
    });
    setSaveSuccess(false);
    setErrorMessage(null);
    // Move focus into the dialog and restore it to the opener on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKeyDown);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commitCommentLimit = (rawValue: string | number) => {
    const clamped = clampCommentLimit(rawValue);
    setSettings(prev => ({ ...prev, maxComments: clamped }));
    setCommentInputStr(String(clamped));
  };

  const handleSave = async () => {
    // Ensure current typed string is committed before saving
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
    closeTimerRef.current = setTimeout(() => {
      setSaveSuccess(false);
      onSaved?.();
      onClose();
    }, 400);
  };

  const handleClearAllStorage = async () => {
    if (!confirm('Reset all settings to default?')) return;
    setErrorMessage(null);
    try {
      await StorageService.clearAllData();
    } catch {
      setErrorMessage('Settings could not be reset. Please try again.');
      return;
    }
    setSettings({ ...DEFAULT_SETTINGS });
    setCommentInputStr(String(DEFAULT_SETTINGS.maxComments));
    onClearSession?.();
    onSaved?.();
  };

  return (
    <div className="rdg-modal-overlay animate-fade-in" style={{ zIndex: 1000 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="rdg-modal"
        style={{ maxWidth: 440 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rdg-settings-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        {/* Header */}
        <div className="rdg-card-header" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24,
              height: 24,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--royal-blue-dim)',
              border: '1.5px solid var(--royal-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--royal-blue)'
            }}>
              <Sliders size={13} />
            </div>
            <h2 id="rdg-settings-title" style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rdg-btn-ghost"
            style={{ padding: 4 }}
            aria-label="Close settings"
            title="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Privacy & Engine Architecture Banner */}
          <div style={{
            background: 'var(--positive-dim)',
            border: '1.5px solid var(--positive-border, rgba(16, 185, 129, 0.3))',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10
          }}>
            <ShieldCheck size={18} style={{ color: 'var(--positive)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--positive)' }}>
                100% Local Discussion Engine
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: 2 }}>
                RedditDIG runs entirely in your browser with zero remote servers, zero external LLMs, and zero telemetry. Thread content never leaves your computer.
              </div>
            </div>
          </div>

          {/* Comment Reading Limit */}
          <div className="rdg-filter-row" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="rdg-filter-label" htmlFor="rdg-max-comments" style={{ marginBottom: 0 }}>Comments to Read</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  id="rdg-max-comments"
                  type="number"                  min={50}
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
                    width: 72,
                    padding: '3px 6px',
                    fontSize: 11,
                    textAlign: 'right',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--royal-blue)',
                    border: '1.5px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                />
                <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>comments</span>
              </div>
            </div>

            {/* Quick preset buttons */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
                    minWidth: 54,
                    padding: '3px 6px',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    justifyContent: 'center',
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
              style={{ width: '100%', accentColor: 'var(--royal-blue)', cursor: 'pointer', margin: '4px 0' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              <span>100 (Quick)</span>
              <span>1k (Standard)</span>
              <span>5k (Deep)</span>
              <span>10k (Maximum)</span>
            </div>
          </div>

          {/* Smart Search Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: '#ffffff',
            border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Smart Meaning Search</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Find comments by topic and subword similarity in memory</div>
            </div>
            <input
              type="checkbox"
              aria-label="Smart Meaning Search"
              checked={settings.similaritySearchEnabled}
              onChange={e => setSettings({ ...settings, similaritySearchEnabled: e.target.checked })}
              style={{ accentColor: 'var(--royal-blue)', width: 16, height: 16, cursor: 'pointer' }}
            />
          </div>

          {/* Auto Analysis Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: '#ffffff',
            border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Auto-Read on Open</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Automatically start reading comments when opening a post</div>
            </div>
            <input
              type="checkbox"
              aria-label="Auto-Read on Open"
              checked={settings.autoAnalysis}
              onChange={e => setSettings({ ...settings, autoAnalysis: e.target.checked })}
              style={{ accentColor: 'var(--royal-blue)', width: 16, height: 16, cursor: 'pointer' }}
            />
          </div>

          {/* Reset Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => {
                onClearSession?.();
                onClose();
              }}
              className="rdg-btn rdg-btn-secondary"
              style={{ flex: 1, padding: '7px 10px', fontSize: 11 }}
            >
              <RefreshCw size={11} />
              <span>Clear Current Data</span>
            </button>

            <button
              type="button"
              onClick={handleClearAllStorage}
              className="rdg-btn"
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: 11,
                background: 'var(--negative-dim)',
                color: 'var(--negative)',
                borderColor: 'var(--negative-border)'
              }}
            >
              <Trash2 size={11} />
              <span>Reset Settings</span>
            </button>
          </div>

          {errorMessage && (
            <div className="rdg-error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '12px 16px',
          borderTop: '1.5px solid var(--border-default)',
          background: '#ffffff'
        }}>
          <button
            type="button"
            onClick={onClose}
            className="rdg-btn rdg-btn-secondary"
            style={{ padding: '6px 14px', fontSize: 11 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rdg-btn rdg-btn-primary"
            style={{ padding: '6px 16px', fontSize: 11 }}
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 size={12} />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Settings</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
