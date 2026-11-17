import React, { useState } from 'react';
import { X, Folder } from 'lucide-react';
import type { AppConfig } from '../types';

interface SettingsModalProps {
  config: AppConfig;
  onSave: (newConfig: AppConfig) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ config, onSave, onClose }) => {
  const [form, setForm] = useState<AppConfig>({ ...config });

  const handleBrowseFolder = async () => {
    if (!window.electronAPI) return;
    const selected = await window.electronAPI.selectDirectory(form.defaultSaveDir);
    if (selected) setForm({ ...form, defaultSaveDir: selected });
  };

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  return (
    <div className="modal-mask" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div>
            <h2 id="settings-title">Settings</h2>
            <p className="text-sm text-tertiary">Video quality, output folder and tool locations.</p>
          </div>
          <button className="btn btn-text btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="field">
              <label className="field-label" htmlFor="bitrate">Video bitrate</label>
              <select id="bitrate" value={form.defaultBitrate} onChange={(e) => setForm({ ...form, defaultBitrate: e.target.value })}>
                <option value="10M">10 Mbps</option>
                <option value="20M">20 Mbps (recommended)</option>
                <option value="40M">40 Mbps</option>
                <option value="60M">60 Mbps</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="fps">Frame rate</label>
              <select id="fps" value={form.defaultFps} onChange={(e) => setForm({ ...form, defaultFps: parseInt(e.target.value) || 60 })}>
                <option value={30}>30 fps</option>
                <option value={60}>60 fps</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="save-dir">Default output folder</label>
            <div className="field-row">
              <input id="save-dir" type="text" value={form.defaultSaveDir} onChange={(e) => setForm({ ...form, defaultSaveDir: e.target.value })} />
              <button type="button" onClick={handleBrowseFolder} className="btn">
                <Folder size={16} /> Browse
              </button>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="scrcpy-path">scrcpy path</label>
            <input id="scrcpy-path" type="text" className="mono" value={form.scrcpyPath} onChange={(e) => setForm({ ...form, scrcpyPath: e.target.value })} />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="ffmpeg-path">FFmpeg path</label>
            <input id="ffmpeg-path" type="text" className="mono" value={form.ffmpegPath} onChange={(e) => setForm({ ...form, ffmpegPath: e.target.value })} />
            <span className="text-sm text-tertiary">Used to join paused segments and mix audio.</span>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.stayAwake} onChange={(e) => setForm({ ...form, stayAwake: e.target.checked })} />
            Keep device awake while recording
          </label>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn">Cancel</button>
          <button onClick={handleSave} className="btn btn-primary">Save</button>
        </div>
      </div>
    </div>
  );
};
