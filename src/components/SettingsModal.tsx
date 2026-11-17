import React, { useState } from 'react';
import { X, Save, Folder, Cpu, Volume2 } from 'lucide-react';
import type { AppConfig } from '../types';

interface SettingsModalProps {
  config: AppConfig;
  onSave: (newConfig: AppConfig) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  onSave,
  onClose
}) => {
  const [form, setForm] = useState<AppConfig>({ ...config });

  const handleBrowseFolder = async () => {
    if (!window.electronAPI) return;
    const selected = await window.electronAPI.selectDirectory(form.defaultSaveDir);
    if (selected) {
      setForm({ ...form, defaultSaveDir: selected });
    }
  };

  const handleSave = () => {
    onSave(form);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(4, 6, 12, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '24px'
    }}>
      <div className="glass-panel" style={{
        width: '640px',
        borderRadius: '24px',
        padding: '28px',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: 'var(--text-muted)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px' }}>Recorder Settings</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '20px' }}>
          Tune high-bitrate capture profiles, hardware encoders, and system binary locations.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quality & Bitrate */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Cpu size={16} color="#60a5fa" />
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Capture Bitrate & Frame Rate</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Video Bitrate
                </label>
                <select
                  value={form.defaultBitrate}
                  onChange={(e) => setForm({ ...form, defaultBitrate: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="10M">10 Mbps (Standard HD)</option>
                  <option value="20M">20 Mbps (High Bitrate - Recommended)</option>
                  <option value="40M">40 Mbps (Ultra 4K Crisp)</option>
                  <option value="60M">60 Mbps (Master Lossless)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Target Frame Rate
                </label>
                <select
                  value={form.defaultFps}
                  onChange={(e) => setForm({ ...form, defaultFps: parseInt(e.target.value) || 60 })}
                  style={{ width: '100%' }}
                >
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS (Smooth Motion)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audio Configuration */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Volume2 size={16} color="#10b981" />
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Audio Capture Source</span>
            </div>
            <select
              value={form.audioSource}
              onChange={(e) => setForm({ ...form, audioSource: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="playback">Internal Playback Audio (Device Sounds)</option>
              <option value="mic">Microphone (Host Mic or Device Mic)</option>
              <option value="output">Device Output Forwarding</option>
            </select>
          </div>

          {/* Default Destination Directory */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Default Output Directory (Tutorials)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={form.defaultSaveDir}
                onChange={(e) => setForm({ ...form, defaultSaveDir: e.target.value })}
                style={{ flex: 1, fontSize: '12px' }}
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                className="btn-secondary"
                style={{ padding: '8px 12px', fontSize: '12px' }}
              >
                <Folder size={14} /> Browse
              </button>
            </div>
          </div>

          {/* Binary Path Overrides */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              scrcpy Executable Path
            </label>
            <input
              type="text"
              value={form.scrcpyPath}
              onChange={(e) => setForm({ ...form, scrcpyPath: e.target.value })}
              style={{ width: '100%', fontSize: '11px', fontFamily: 'monospace' }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '24px',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '18px'
        }}>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            <Save size={15} /> Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
