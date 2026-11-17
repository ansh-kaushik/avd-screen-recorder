import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Smartphone } from 'lucide-react';
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
  const state = isRecording ? (isPaused ? 'paused' : 'recording') : 'idle';

  return (
    <div className="stage-canvas">
      <div className="device" data-state={state}>
        <div className="device-screen">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ display: isLiveStreamActive ? 'block' : 'none' }}
          />
          {!isLiveStreamActive && snapshotUrl && <img src={snapshotUrl} alt="Emulator screen" />}
          {!isLiveStreamActive && !snapshotUrl && (
            <div className="device-empty">
              <Smartphone size={28} aria-hidden />
              <strong>{selectedDevice ? `Connecting to ${selectedDevice.id}…` : 'No emulator running'}</strong>
              <span className="text-sm">Start an AVD in Android Studio</span>
            </div>
          )}
        </div>
      </div>

      <div className="stage-tools">
        <button
          className="btn btn-icon"
          onClick={handleManualRefresh}
          disabled={!selectedDevice || isRefreshingPreview}
          aria-label="Refresh preview"
          title="Refresh preview"
        >
          <RefreshCw size={16} className={isRefreshingPreview ? 'spin' : ''} />
        </button>
        <button
          className="btn btn-icon"
          onClick={handleTakeSnapshot}
          disabled={!selectedDevice}
          aria-label="Save screenshot (PNG)"
          title="Save screenshot (PNG)"
        >
          <Camera size={16} />
        </button>
      </div>

      <span className="tag mono" style={{ position: 'absolute', bottom: 0, right: 0 }}>
        {resolution} · {fps} fps · {bitrate}
      </span>
    </div>
  );
};
