import React from 'react';
import { Smartphone, RefreshCw, Settings, Video, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { AndroidDevice } from '../types';

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
}

export const Header: React.FC<HeaderProps> = ({
  devices,
  selectedDeviceId,
  onSelectDevice,
  onRefreshDevices,
  isLoadingDevices,
  isRecording,
  isPaused,
  onOpenSettings,
  selectedDevice
}) => {
  return (
    <header className="glass-panel" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      margin: '16px 20px 0 20px',
      borderRadius: '16px',
      zIndex: 20
    }}>
      {/* Brand Logo & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)'
        }}>
          <Video size={22} color="#fff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.02em' }}>AVD STUDIO</h1>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'rgba(59, 130, 246, 0.2)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>PRO 4K</span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Zero-Limit Android Emulator Recorder</p>
        </div>
      </div>

      {/* Device Selector & Live Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Device Picker */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(10, 14, 24, 0.7)',
          padding: '6px 12px',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)'
        }}>
          <Smartphone size={16} color="#60a5fa" />
          <select
            value={selectedDeviceId}
            onChange={(e) => onSelectDevice(e.target.value)}
            disabled={isRecording}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '2px 6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isRecording ? 'not-allowed' : 'pointer'
            }}
          >
            {devices.length === 0 ? (
              <option value="">No Android Device Detected</option>
            ) : (
              devices.map((d) => (
                <option key={d.id} value={d.id} style={{ background: '#0e131f' }}>
                  {d.id} ({d.model || 'Android'} - {d.resolution})
                </option>
              ))
            )}
          </select>

          <button
            onClick={onRefreshDevices}
            disabled={isLoadingDevices || isRecording}
            title="Refresh Devices"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <RefreshCw size={14} className={isLoadingDevices ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 700,
          background: isRecording
            ? isPaused
              ? 'rgba(245, 158, 11, 0.15)'
              : 'rgba(239, 68, 68, 0.18)'
            : selectedDevice
            ? 'rgba(16, 185, 129, 0.15)'
            : 'rgba(239, 68, 68, 0.15)',
          color: isRecording
            ? isPaused
              ? '#f59e0b'
              : '#ef4444'
            : selectedDevice
            ? '#10b981'
            : '#ef4444',
          border: `1px solid ${
            isRecording
              ? isPaused
                ? 'rgba(245, 158, 11, 0.4)'
                : 'rgba(239, 68, 68, 0.4)'
              : selectedDevice
              ? 'rgba(16, 185, 129, 0.3)'
              : 'rgba(239, 68, 68, 0.3)'
          }`
        }}>
          {isRecording ? (
            <>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isPaused ? '#f59e0b' : '#ef4444'
              }} className={isPaused ? 'pause-pulsing' : 'rec-pulsing'} />
              {isPaused ? 'PAUSED' : 'RECORDING'}
            </>
          ) : selectedDevice ? (
            <>
              <ShieldCheck size={14} />
              READY ({selectedDevice.resolution})
            </>
          ) : (
            <>
              <AlertTriangle size={14} />
              NO DEVICE
            </>
          )}
        </div>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="btn-secondary"
          style={{ padding: '8px 12px' }}
          title="Recorder Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
};
