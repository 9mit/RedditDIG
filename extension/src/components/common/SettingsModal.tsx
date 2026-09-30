import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, RefreshCw, Trash2, Sliders } from 'lucide-react';
import { StorageService, AppSettings, DEFAULT_SETTINGS } from '../../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onClearSession?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved, onClearSession }) => {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      StorageService.getSettings().then(s => {
        setSettings(s);
      });
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    await StorageService.saveSettings(settings);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onSaved?.();
      onClose();
    }, 400);
  };

  const handleClearAllStorage = async () => {
    if (confirm('Reset all settings to default?')) {
      await StorageService.clearAllData();
      setSettings({ ...DEFAULT_SETTINGS });
      onClearSession?.();
      onSaved?.();
    }
  };

  return (
    <div className="rdg-modal-overlay animate-fade-in" style={{ zIndex: 1000 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rdg-modal" style={{ maxWidth: 440 }}>
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
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Settings
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rdg-btn-ghost"
            style={{ padding: 4 }}
          >
            <X size={16} />
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
          <div className="rdg-filter-row">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="rdg-filter-label">Comments to Read</label>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--royal-blue)', fontWeight: 700, fontSize: 11 }}>
                {settings.maxComments} comments
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={1500}
              step={50}
              value={settings.maxComments}
              onChange={e => setSettings({ ...settings, maxComments: Number(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--royal-blue)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              <span>50 (Fastest)</span>
              <span>500 (Standard)</span>
              <span>1500 (Deepest)</span>
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
