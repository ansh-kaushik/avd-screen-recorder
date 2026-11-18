import React, { useEffect, useState } from 'react';
import { Play, Pause, Square, Loader2, Mic } from 'lucide-react';

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
  micEnabled: boolean;
  micLevel: number;
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
  hasDevice,
  micEnabled,
  micLevel
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

  const state = isRecording ? (isPaused ? 'Paused' : 'Recording') : 'Ready';
  const badge = isRecording ? (isPaused ? 'badge-warning' : 'badge-error badge-processing') : 'badge-success';
  const meterPct = Math.min(100, Math.round(micLevel * 100));

  return (
    <div className="card control-bar">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span className={`badge text-sm ${hasDevice ? badge : ''}`}>
          {hasDevice ? state : 'No device'}
          {isRecording && segmentCount > 1 && <span className="tag tag-blue">Segment {segmentCount}</span>}
        </span>
        <span className="mono" style={{ fontSize: '20px', lineHeight: '28px', color: isRecording ? 'var(--text)' : 'var(--text-tertiary)' }}>
          {formatTime(elapsedMs)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {!isRecording ? (
          <button
            onClick={onStart}
            disabled={!hasDevice || isProcessing}
            className="btn-record"
            aria-label="Start recording (R)"
            title={hasDevice ? 'Start recording (R)' : 'Connect an emulator first'}
          />
        ) : (
          <>
            <button
              onClick={isPaused ? onResume : onPause}
              disabled={isProcessing}
              className="btn btn-lg"
              title={isPaused ? 'Resume (P)' : 'Pause (P)'}
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={onStop}
              disabled={isProcessing}
              className="btn btn-lg btn-danger"
              title="Stop and review"
            >
              {isProcessing ? <Loader2 size={16} className="spin" /> : <Square size={16} />}
              {isProcessing ? 'Saving…' : 'Stop'}
            </button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <span className="text-sm text-secondary">{bitrate} · {fps} fps · MP4</span>
        {micEnabled ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '140px' }} title="Microphone level">
            <Mic size={14} color="var(--text-tertiary)" aria-hidden />
            <div className="meter" style={{ flex: 1 }} role="meter" aria-label="Microphone level" aria-valuenow={meterPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="meter-fill" data-level={micLevel > 0.9 ? 'clip' : micLevel > 0.6 ? 'warn' : 'ok'} style={{ width: `${meterPct}%` }} />
            </div>
          </div>
        ) : (
          <span className="text-sm text-tertiary">Mic off</span>
        )}
      </div>
    </div>
  );
};
