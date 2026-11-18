import React from 'react';
import { Monitor, Moon, RefreshCw, Settings, Sun, Video } from 'lucide-react';
import type { AndroidDevice, ThemeMode } from '../types';

interface HeaderProps {
  devices: AndroidDevice[];
  selectedDeviceId: string;
  onSelectDevice: (id: string) => void;
  onRefreshDevices: () => void;
  isLoadingDevices: boolean;
  isRecording: boolean;
  isPaused: boolean;
  onOpenSettings: () => void;
  selectedDevice?: AndroidDevice;
  isBrowser: boolean;
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
}

const THEMES: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: 'Follow system theme', icon: <Monitor size={14} /> },
  { value: 'light', label: 'Light theme', icon: <Sun size={14} /> },
  { value: 'dark', label: 'Dark theme', icon: <Moon size={14} /> }
];

export const Header: React.FC<HeaderProps> = ({
  devices,
  selectedDeviceId,
  onSelectDevice,
  onRefreshDevices,
  isLoadingDevices,
  isRecording,
  isPaused,
  onOpenSettings,
  selectedDevice,
  isBrowser,
  theme,
  onThemeChange
}) => {
  const status = isRecording
    ? isPaused
      ? { cls: 'badge-warning', text: 'Paused' }
      : { cls: 'badge-error badge-processing', text: 'Recording' }
    : selectedDevice || isBrowser
      ? { cls: 'badge-success', text: 'Ready' }
      : { cls: '', text: 'No device' };

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Video size={20} color="var(--color-primary)" aria-hidden />
        <h1 style={{ fontSize: '16px', lineHeight: '24px' }}>AVD Studio</h1>
        <span className="text-tertiary text-sm">Android emulator recorder</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {isBrowser ? (
          <span className="tag tag-blue">Browser · AVD Studio Browser window</span>
        ) : (
        <div className="field-row" style={{ alignItems: 'center' }}>
          <select
            aria-label="Android device"
            value={selectedDeviceId}
            onChange={(e) => onSelectDevice(e.target.value)}
            disabled={isRecording}
            title={isRecording ? 'Stop recording to switch device' : undefined}
            style={{ width: '320px' }}
          >
            {devices.length === 0 ? (
              <option value="">No device detected</option>
            ) : (
              devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.model || 'Android'} · {d.id} · {d.resolution}
                </option>
              ))
            )}
          </select>
          <button
            className="btn btn-icon"
            onClick={onRefreshDevices}
            disabled={isLoadingDevices || isRecording}
            aria-label="Refresh devices"
            title="Refresh devices"
          >
            <RefreshCw size={16} className={isLoadingDevices ? 'spin' : ''} />
          </button>
        </div>
        )}

        <span className={`badge ${status.cls}`} role="status" style={{ minWidth: '88px' }}>{status.text}</span>

        <div className="segmented" role="group" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.value} aria-pressed={theme === t.value} aria-label={t.label} title={t.label} onClick={() => onThemeChange(t.value)}>
              {t.icon}
            </button>
          ))}
        </div>

        <button className="btn btn-icon" onClick={onOpenSettings} aria-label="Settings" title="Settings">
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
};
