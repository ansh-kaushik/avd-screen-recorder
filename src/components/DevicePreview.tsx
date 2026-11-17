import React, { useEffect, useRef, useState } from 'react';
import { Camera, Sparkles, Wifi, BatteryCharging, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import type { AndroidDevice } from '../types';

interface DevicePreviewProps {
  selectedDevice?: AndroidDevice;
  isRecording: boolean;
  isPaused: boolean;
  bitrate: string;
  fps: number;
}

export const DevicePreview: React.FC<DevicePreviewProps> = ({
  selectedDevice,
  isRecording,
  isPaused,
  bitrate,
  fps
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [isLiveStreamActive, setIsLiveStreamActive] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isRefreshingPreview, setIsRefreshingPreview] = useState<boolean>(false);

  // Attempt WebRTC Desktop Capture
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isCancelled = false;

    async function initStream() {
      if (!window.electronAPI) return;

      try {
        const res = await window.electronAPI.getScreenSources();
        if (isCancelled) return;

        if (res.success && res.sources && res.sources.length > 0) {
          const emuSource = res.sources.find((s) => s.isEmulator) || res.sources.find((s) => /android|emulator|qemu/i.test(s.name));

          if (emuSource) {
            const stream = await (navigator.mediaDevices as any).getUserMedia({
              audio: false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: emuSource.id,
                  minWidth: 720,
                  maxWidth: 1920,
                  minHeight: 1280,
                  maxHeight: 2400,
                  maxFrameRate: 60
                }
              }
            });

            if (isCancelled) {
              stream.getTracks().forEach((t: any) => t.stop());
              return;
            }

            activeStream = stream;
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch(() => {});
              setIsLiveStreamActive(true);
            }
            return;
          }
        }
      } catch (err: any) {
        // Fallback to polled screenshot
      }

      setIsLiveStreamActive(false);
    }

    initStream();

    return () => {
      isCancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [selectedDevice?.id]);

  // Robust snapshot polling loop
  useEffect(() => {
    if (isLiveStreamActive || !selectedDevice?.id || !window.electronAPI) return;

    let timer: any = null;
    let isMounted = true;

    async function pollScreenshot() {
      if (!window.electronAPI || !selectedDevice) return;
      try {
        const res = await window.electronAPI.captureScreenshot(selectedDevice.id);
        if (isMounted && res.success && res.dataUrl) {
          setSnapshotUrl(res.dataUrl);
        }
      } catch (e) {}

      if (isMounted) {
        timer = setTimeout(pollScreenshot, 600);
      }
    }

    pollScreenshot();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [isLiveStreamActive, selectedDevice?.id]);

  // Manual fast refresh
  const handleManualRefresh = async () => {
    if (!window.electronAPI || !selectedDevice) return;
    setIsRefreshingPreview(true);
    try {
      const res = await window.electronAPI.captureScreenshot(selectedDevice.id);
      if (res.success && res.dataUrl) {
        setSnapshotUrl(res.dataUrl);
      }
    } finally {
      setIsRefreshingPreview(false);
    }
  };

  // Take manual snapshot
  const handleTakeSnapshot = async () => {
    if (!window.electronAPI || !selectedDevice) return;
    const res = await window.electronAPI.captureScreenshot(selectedDevice.id);
    if (res.success && res.dataUrl) {
      const a = document.createElement('a');
      a.href = res.dataUrl;
      a.download = `snapshot_${selectedDevice.id}_${Date.now()}.png`;
      a.click();
    }
  };

  const resolution = selectedDevice?.resolution || '1080x2400';

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      padding: '16px 20px',
      overflow: 'hidden'
    }}>
      {/* Ambient Device Glow */}
      <div style={{
        position: 'absolute',
        width: isExpanded ? '380px' : '280px',
        height: isExpanded ? '640px' : '520px',
        borderRadius: '40px',
        background: isRecording
          ? isPaused
            ? 'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
        filter: 'blur(30px)',
        zIndex: 1,
        transition: 'all 0.5s ease'
      }} />

      {/* Realistic Mobile Device Mockup Frame */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        width: isExpanded ? '340px' : '270px',
        height: isExpanded ? '620px' : '490px',
        background: '#04060a',
        borderRadius: '36px',
        padding: '10px',
        border: `3px solid ${
          isRecording
            ? isPaused
              ? 'rgba(245, 158, 11, 0.6)'
              : 'rgba(239, 68, 68, 0.7)'
            : 'rgba(255, 255, 255, 0.15)'
        }`,
        boxShadow: `0 25px 60px -15px rgba(0, 0, 0, 0.9), inset 0 0 10px rgba(255, 255, 255, 0.05), ${
          isRecording
            ? isPaused
              ? '0 0 30px rgba(245, 158, 11, 0.25)'
              : '0 0 35px rgba(239, 68, 68, 0.35)'
            : '0 0 25px rgba(59, 130, 246, 0.1)'
        }`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Device Speaker & Camera Notch */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70px',
          height: '14px',
          background: '#000',
          borderRadius: '8px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#1e293b' }} />
          <div style={{ width: '24px', height: '3px', borderRadius: '2px', background: '#334155' }} />
        </div>

        {/* Inner Screen Display Area */}
        <div style={{
          position: 'relative',
          flex: 1,
          borderRadius: '26px',
          overflow: 'hidden',
          background: '#0a0f1d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Live Video Feed (WebRTC) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: isLiveStreamActive ? 'block' : 'none'
            }}
          />

          {/* Polled Image Screenshot Fallback */}
          {!isLiveStreamActive && snapshotUrl && (
            <img
              src={snapshotUrl}
              alt="AVD Screen"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          )}

          {/* Empty / Connecting State */}
          {!isLiveStreamActive && !snapshotUrl && (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: 'var(--text-dim)'
            }}>
              <Sparkles size={32} color="#3b82f6" style={{ margin: '0 auto 12px auto', display: 'block', animation: 'spin 4s linear infinite' }} />
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                {selectedDevice ? `Connecting to ${selectedDevice.id}...` : 'No Android Emulator Active'}
              </p>
              <p style={{ fontSize: '11px', marginTop: '6px' }}>
                Launch your AVD emulator in Android Studio
              </p>
            </div>
          )}

          {/* Top Status Bar Inside Device */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '28px',
            padding: '4px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
            fontSize: '10px',
            fontWeight: 700,
            color: '#fff',
            zIndex: 5
          }}>
            <span>12:00</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Wifi size={11} />
              <BatteryCharging size={11} />
            </div>
          </div>

          {/* Floating Recording HUD Tag */}
          {isRecording && (
            <div style={{
              position: 'absolute',
              top: '36px',
              left: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isPaused ? 'rgba(245, 158, 11, 0.9)' : 'rgba(239, 68, 68, 0.9)',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 6
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#fff'
              }} className={isPaused ? '' : 'rec-pulsing'} />
              {isPaused ? 'PAUSED' : `REC [${bitrate}]`}
            </div>
          )}

          {/* Resolution Badge at Bottom */}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '3px 8px',
            borderRadius: '8px',
            fontSize: '10px',
            fontWeight: 600,
            color: '#cbd5e1',
            zIndex: 6
          }}>
            {resolution} • {fps} FPS
          </div>
        </div>
      </div>

      {/* Floating Canvas Action Controls */}
      <div style={{
        position: 'absolute',
        right: '24px',
        top: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 10
      }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="btn-secondary"
          title={isExpanded ? 'Standard View' : 'Enlarge Preview'}
          style={{ padding: '8px', borderRadius: '10px' }}
        >
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button
          onClick={handleManualRefresh}
          disabled={!selectedDevice || isRefreshingPreview}
          className="btn-secondary"
          title="Refresh Preview"
          style={{ padding: '8px', borderRadius: '10px' }}
        >
          <RefreshCw size={16} className={isRefreshingPreview ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={handleTakeSnapshot}
          disabled={!selectedDevice}
          className="btn-secondary"
          title="Take Instant Snapshot (PNG)"
          style={{ padding: '8px', borderRadius: '10px' }}
        >
          <Camera size={16} />
        </button>
      </div>
    </div>
  );
};
