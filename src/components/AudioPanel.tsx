import React from 'react';
import { Globe, Mic, MousePointer2, MousePointerClick, Smartphone, Volume2, VolumeX } from 'lucide-react';
import type { AppConfig } from '../types';

interface AudioPanelProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
  onOpenBrowser: () => void;
  isRecording: boolean;
  micDevices: MediaDeviceInfo[];
  micLevel: number;
  micError: string | null;
}

const VolumeRow: React.FC<{
  label: string;
  value: number;
  muted: boolean;
  disabled: boolean;
  onVolume: (v: number) => void;
  onMute: () => void;
}> = ({ label, value, muted, disabled, onVolume, onMute }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <button
      type="button"
      className={`btn btn-icon ${muted ? 'btn-danger' : 'btn-text'}`}
      onClick={onMute}
      disabled={disabled}
      aria-pressed={muted}
      aria-label={muted ? `Unmute ${label}` : `Mute ${label}`}
      title={muted ? `Unmute ${label}` : `Mute ${label}`}
    >
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
    <input
      type="range"
      min={0}
      max={200}
      step={5}
      value={Math.round(value * 100)}
      disabled={disabled || muted}
      aria-label={`${label} volume`}
      onChange={(e) => onVolume(Number(e.target.value) / 100)}
      style={{ flex: 1, minWidth: 0 }}
    />
    <span className="mono text-sm text-secondary" style={{ width: '40px', textAlign: 'right' }}>
      {muted ? 'Muted' : `${Math.round(value * 100)}%`}
    </span>
  </div>
);

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
  toggleDisabled?: boolean;
  toggleTitle?: string;
  children?: React.ReactNode;
}> = ({ icon, title, hint, on, onToggle, toggleDisabled, toggleTitle, children }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1 }}>
        <div className="card-title">{icon}{title}</div>
        <div className="text-sm text-tertiary">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        className="switch"
        aria-checked={on}
        aria-label={`${title} ${on ? 'on' : 'off'}`}
        title={toggleTitle}
        disabled={toggleDisabled}
        onClick={onToggle}
      />
    </div>
    {children}
  </section>
);

export const AudioPanel: React.FC<AudioPanelProps> = ({ config, onChange, onOpenBrowser, isRecording, micDevices, micLevel, micError }) => {
  const isBrowser = config.source === 'browser';
  const num = (v: string) => Math.max(1, Math.round(Number(v) || 0));
  const meterPct = Math.min(100, Math.round(micLevel * 100));
  const meterLevel = micLevel > 0.9 ? 'clip' : micLevel > 0.6 ? 'warn' : 'ok';
  const lockedTitle = isRecording ? 'Stop recording to change this' : undefined;
  const inputs = micDevices.filter((d) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');

  return (
    <aside className="sider" aria-label="Capture options">
      <h2>Capture</h2>

      <div className="segmented" role="group" aria-label="Source" style={{ display: 'flex' }}>
        {([['device', 'Device', <Smartphone size={14} key="i" />], ['browser', 'Browser', <Globe size={14} key="i" />]] as const).map(([value, label, icon]) => (
          <button
            key={value}
            aria-pressed={config.source === value}
            disabled={isRecording}
            title={lockedTitle}
            onClick={() => onChange({ source: value })}
            style={{ flex: 1, gap: '8px' }}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {isBrowser && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="field">
            <label className="field-label text-sm" htmlFor="browser-url">Website</label>
            <div className="field-row">
              <input
                id="browser-url"
                type="text"
                value={config.browserUrl}
                disabled={isRecording}
                onChange={(e) => onChange({ browserUrl: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && onOpenBrowser()}
                placeholder="https://example.com"
              />
              <button className="btn btn-primary" onClick={onOpenBrowser} disabled={isRecording || !config.browserUrl}>Open</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="field">
              <label className="field-label text-sm" htmlFor="vp-w">Viewport (CSS px)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <input id="vp-w" type="text" inputMode="numeric" aria-label="Viewport width" value={config.browserWidth} disabled={isRecording} onChange={(e) => onChange({ browserWidth: num(e.target.value) })} style={{ width: '100%', minWidth: 0, padding: '4px 7px' }} />
                <input type="text" inputMode="numeric" aria-label="Viewport height" value={config.browserHeight} disabled={isRecording} onChange={(e) => onChange({ browserHeight: num(e.target.value) })} style={{ width: '100%', minWidth: 0, padding: '4px 7px' }} />
              </div>
            </div>
            <div className="field">
              <label className="field-label text-sm" htmlFor="out-w">Video (px)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <input id="out-w" type="text" inputMode="numeric" aria-label="Video width" value={config.browserOutWidth} disabled={isRecording} onChange={(e) => onChange({ browserOutWidth: num(e.target.value) })} style={{ width: '100%', minWidth: 0, padding: '4px 7px' }} />
                <input type="text" inputMode="numeric" aria-label="Video height" value={config.browserOutHeight} disabled={isRecording} onChange={(e) => onChange({ browserOutHeight: num(e.target.value) })} style={{ width: '100%', minWidth: 0, padding: '4px 7px' }} />
              </div>
            </div>
          </div>
          <span className="text-sm text-tertiary">
            Pixel ratio {(config.browserOutWidth / config.browserWidth).toFixed(2)}. Size changes apply when you press Open.
          </span>
        </section>
      )}

      <div className="divider" />

      <Section
        icon={<MousePointer2 size={16} />}
        title="Show cursor"
        hint={isBrowser ? "Your pointer over the page" : "Your PC pointer over the emulator"}
        on={config.showCursor}
        onToggle={() => onChange({ showCursor: !config.showCursor })}
        toggleDisabled={isRecording}
        toggleTitle={lockedTitle}
      >
        {config.showCursor && (
          <p className="text-sm text-secondary">
            Added to the video when you stop, so saving takes a little longer.
          </p>
        )}
      </Section>

      {!isBrowser && (
      <Section
        icon={<MousePointerClick size={16} />}
        title="Show taps"
        hint="Dots where you click or tap"
        on={config.showTouches}
        onToggle={() => onChange({ showTouches: !config.showTouches })}
        toggleDisabled={isRecording}
        toggleTitle={lockedTitle}
      />
      )}

      <div className="divider" />

      {!isBrowser && (<>
      <Section
        icon={<Smartphone size={16} />}
        title="Device audio"
        hint="Sound from the emulator"
        on={config.audioEnabled}
        onToggle={() => onChange({ audioEnabled: !config.audioEnabled })}
        toggleDisabled={isRecording}
        toggleTitle={lockedTitle}
      >
        <div className="field">
          <label className="field-label text-sm" htmlFor="audio-source">Source</label>
          <select
            id="audio-source"
            value={config.audioSource}
            disabled={!config.audioEnabled || isRecording}
            title={lockedTitle}
            onChange={(e) => onChange({ audioSource: e.target.value })}
          >
            <option value="output">Device output</option>
            <option value="playback">App playback (Android 13+)</option>
            <option value="mic">Device microphone</option>
          </select>
        </div>
        <VolumeRow
          label="device audio"
          value={config.audioVolume}
          muted={config.audioMuted}
          disabled={!config.audioEnabled}
          onVolume={(v) => onChange({ audioVolume: v })}
          onMute={() => onChange({ audioMuted: !config.audioMuted })}
        />
      </Section>

      <div className="divider" />
      </>)}

      <Section
        icon={<Mic size={16} />}
        title="Microphone"
        hint="Voice-over from this PC"
        on={config.micEnabled}
        onToggle={() => onChange({ micEnabled: !config.micEnabled })}
      >
        <div className="field">
          <label className="field-label text-sm" htmlFor="mic-device">Input device</label>
          <select
            id="mic-device"
            value={config.micDeviceId}
            disabled={!config.micEnabled}
            onChange={(e) => onChange({ micDeviceId: e.target.value })}
          >
            <option value="">System default</option>
            {inputs.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>
            ))}
          </select>
        </div>
        <VolumeRow
          label="microphone"
          value={config.micVolume}
          muted={config.micMuted}
          disabled={!config.micEnabled}
          onVolume={(v) => onChange({ micVolume: v })}
          onMute={() => onChange({ micMuted: !config.micMuted })}
        />
        <div className="field">
          <span className="text-sm text-secondary">Input level</span>
          <div className="meter" role="meter" aria-label="Microphone level" aria-valuenow={meterPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="meter-fill" data-level={meterLevel} style={{ width: `${meterPct}%` }} />
          </div>
        </div>
        {micError && config.micEnabled && (
          <div className="alert alert-error text-sm" role="alert">{micError}</div>
        )}
      </Section>

      <p className="text-sm text-tertiary" style={{ marginTop: 'auto' }}>
        Volume and mute apply live. The mic is mixed into the saved MP4.
      </p>
    </aside>
  );
};
