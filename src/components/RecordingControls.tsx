import React, { useEffect, useState } from 'react';
import { Play, Pause, Square, Radio, Disc } from 'lucide-react';

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  bitrate: string;
  fps: number;
  segmentCount: number;
  hasDevice: boolean;
}

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  isPaused,
  isProcessing,
  onStart,
  onPause,
  onResume,
  onStop,
  bitrate,
  fps,
  segmentCount,
  hasDevice
}) => {
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  // Accurate Millisecond Timer
  useEffect(() => {
    let interval: any = null;
    let startTimestamp = Date.now() - elapsedMs;

    if (isRecording && !isPaused && !isProcessing) {
      startTimestamp = Date.now() - elapsedMs;
      interval = setInterval(() => {
        setElapsedMs(Date.now() - startTimestamp);
      }, 35);
    } else if (!isRecording) {
      setElapsedMs(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isPaused, isProcessing]);

  // Format Elapsed Time: HH:MM:SS.ms
  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 30,
      width: 'auto',
      minWidth: '580px'
    }}>
      <div className="glass-dock" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 28px',
        gap: '24px'
      }}>
        {/* Left: Live HUD Timer & Waveform */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                color: isRecording ? (isPaused ? '#f59e0b' : '#ef4444') : 'var(--text-dim)',
                letterSpacing: '0.05em'
              }}>
                {isRecording ? (isPaused ? 'PAUSED' : 'REC TIME') : 'STUDIO READY'}
              </span>
              {isRecording && segmentCount > 1 && (
                <span style={{
                  fontSize: '9px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  fontWeight: 700
                }}>
                  SEG {segmentCount}
                </span>
              )}
            </div>

            <span className="font-mono" style={{
              fontSize: '22px',
              fontWeight: 700,
              color: isRecording ? '#ffffff' : 'var(--text-muted)',
              letterSpacing: '0.02em',
              textShadow: isRecording ? '0 0 12px rgba(255, 255, 255, 0.3)' : 'none'
            }}>
              {formatTime(elapsedMs)}
            </span>
          </div>

          {/* Animated VU sound bars */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            height: '24px',
            padding: '0 8px',
            borderLeft: '1px solid var(--border-subtle)'
          }}>
            {[14, 22, 10, 26, 18, 12].map((height, i) => (
              <div
                key={i}
                className="vu-bar"
                style={{
                  height: isRecording && !isPaused ? `${height}px` : '4px',
                  background: isRecording
                    ? isPaused
                      ? '#f59e0b'
                      : i > 3
                      ? '#ef4444'
                      : '#10b981'
                    : 'var(--text-dim)',
                  opacity: isRecording ? 0.9 : 0.4
                }}
              />
            ))}
          </div>
        </div>

        {/* Center: Main Primary Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {!isRecording ? (
            /* Start Recording Button */
            <button
              onClick={onStart}
              disabled={!hasDevice || isProcessing}
              className="btn-record"
              title={hasDevice ? 'Start Recording (Full HD 60fps)' : 'No AVD Connected'}
              style={{
                opacity: hasDevice && !isProcessing ? 1 : 0.45,
                cursor: hasDevice && !isProcessing ? 'pointer' : 'not-allowed'
              }}
            >
              <Disc size={32} />
            </button>
          ) : (
            /* Active Recording Controls (Pause/Resume + Stop) */
            <>
              {/* Pause / Resume Button */}
              <button
                onClick={isPaused ? onResume : onPause}
                disabled={isProcessing}
                className="btn-pause"
                title={isPaused ? 'Resume Recording' : 'Pause Recording'}
              >
                {isPaused ? <Play size={22} fill="#f59e0b" /> : <Pause size={22} fill="#f59e0b" />}
              </button>

              {/* Stop Button */}
              <button
                onClick={onStop}
                disabled={isProcessing}
                className="btn-stop"
                title="Stop Recording and Export"
              >
                {isProcessing ? (
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid rgba(239, 68, 68, 0.3)',
                    borderTopColor: '#ef4444',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                ) : (
                  <Square size={22} fill="#ef4444" />
                )}
              </button>
            </>
          )}
        </div>

        {/* Right: Bitrate & Quality Badges */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={12} color="#10b981" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>
              {bitrate} • {fps} FPS
            </span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
            No 180s limit • Lossless MP4
          </span>
        </div>
      </div>
    </div>
  );
};
