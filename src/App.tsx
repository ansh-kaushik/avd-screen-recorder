import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DevicePreview } from './components/DevicePreview';
import { RecordingControls } from './components/RecordingControls';
import { SaveExportModal } from './components/SaveExportModal';
import { SettingsModal } from './components/SettingsModal';
import { AudioPanel } from './components/AudioPanel';
import { useMic } from './useMic';
import { CheckCircle2, Globe, Info, XCircle } from 'lucide-react';
import type { AndroidDevice, AppConfig, RecordingResult, ThemeMode } from './types';

const DEFAULT_CONFIG: AppConfig = {
  scrcpyPath: 'C:\\Users\\anshk\\Desktop\\dt\\Desktop6_work\\AVD_SCREEN_RECORDER\\scrcpy\\scrcpy.exe',
  ffmpegPath: 'C:\\ffmpeg\\bin\\ffmpeg.exe',
  adbPath: 'C:\\Users\\anshk\\Desktop\\dt\\Desktop6_work\\AVD_SCREEN_RECORDER\\scrcpy\\adb.exe',
  defaultSaveDir: 'C:\\Users\\anshk\\Desktop\\dt\\Desktop6_work\\Editing\\media\\app clips\\tutorials',
  defaultBitrate: '20M',
  defaultFps: 60,
  audioEnabled: true,
  audioSource: 'playback',
  audioVolume: 1,
  audioMuted: false,
  micEnabled: false,
  micDeviceId: '',
  micVolume: 1,
  micMuted: false,
  stayAwake: true,
  showTouches: false,
  showCursor: false,
  source: 'device',
  browserUrl: 'https://web.damapps.com/',
  browserWidth: 390,
  browserHeight: 866,
  browserOutWidth: 1080,
  browserOutHeight: 2400,
  theme: 'system'
};

export function App() {
  const [devices, setDevices] = useState<AndroidDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(false);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [segmentCount, setSegmentCount] = useState<number>(1);

  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [recordingResult, setRecordingResult] = useState<RecordingResult | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const mic = useMic(config.micEnabled, config.micDeviceId, config.micVolume, config.micMuted);

  // Theme: 'system' follows prefers-color-scheme; explicit choice sets data-theme on <html>.
  useEffect(() => {
    const root = document.documentElement;
    if (config.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = config.theme;
  }, [config.theme]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load Initial Config
  useEffect(() => {
    async function init() {
      if (window.electronAPI) {
        try {
          const cfg = await window.electronAPI.getConfig();
          if (cfg) setConfig(cfg);
        } catch (e) {}
      }
    }
    init();
  }, []);

  // Fetch Connected ADB Devices
  const fetchDevices = useCallback(async () => {
    if (!window.electronAPI || isRecording) return;
    setIsLoadingDevices(true);
    try {
      const res = await window.electronAPI.listDevices();
      if (res.success && res.devices) {
        setDevices(res.devices);
        if (res.devices.length > 0 && (!selectedDeviceId || !res.devices.some(d => d.id === selectedDeviceId))) {
          setSelectedDeviceId(res.devices[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to list devices:', e);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [isRecording, selectedDeviceId]);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 4000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  // Start Recording
  const handleStartRecording = async () => {
    if (!window.electronAPI) return;
    if (config.source === 'device' && !selectedDeviceId && devices.length === 0) {
      showToast('No Android device or emulator detected.', 'error');
      return;
    }

    try {
      const res = await window.electronAPI.startRecording({
        deviceId: selectedDeviceId,
        bitrate: config.defaultBitrate,
        maxFps: config.defaultFps,
        audioEnabled: config.audioEnabled,
        audioSource: config.audioSource
      });

      if (res.success) {
        mic.arm();
        setIsRecording(true);
        setIsPaused(false);
        setSegmentCount(1);
        showToast('Recording started with high-bitrate scrcpy stream', 'success');
      } else {
        showToast(res.error || 'Failed to start recording', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error starting recording', 'error');
    }
  };

  // Pause Recording
  const handlePauseRecording = async () => {
    if (!window.electronAPI) return;
    try {
      mic.pause();
      const res = await window.electronAPI.pauseRecording();
      if (res.success) {
        setIsPaused(true);
        showToast('Recording paused', 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to pause', 'error');
    }
  };

  // Resume Recording
  const handleResumeRecording = async () => {
    if (!window.electronAPI) return;
    try {
      const res = await window.electronAPI.resumeRecording();
      if (res.success) {
        mic.expectResume();
        setIsPaused(false);
        setSegmentCount((prev) => prev + 1);
        showToast(`Recording resumed (Segment ${res.chunkIndex || segmentCount + 1})`, 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to resume', 'error');
    }
  };

  // Stop Recording
  const handleStopRecording = async () => {
    if (!window.electronAPI) return;
    setIsProcessing(true);
    showToast('Stitching recording & generating preview...', 'info');

    try {
      const micAudio = await mic.stop();
      const res = await window.electronAPI.stopRecording({
        micAudio,
        deviceVolume: config.audioMuted ? 0 : config.audioVolume
      });
      setIsRecording(false);
      setIsPaused(false);
      setIsProcessing(false);

      if (res.success && res.tempFilePath) {
        setRecordingResult({
          sessionId: res.sessionId || `rec_${Date.now()}`,
          tempFilePath: res.tempFilePath,
          fileSize: res.fileSize || 0,
          chunkCount: res.chunkCount || 1,
          thumbnailDataUrl: res.thumbnailDataUrl,
          defaultSaveDir: res.defaultSaveDir || config.defaultSaveDir
        });
      } else {
        showToast(res.error || 'No video recorded', 'error');
      }
    } catch (err: any) {
      setIsRecording(false);
      setIsProcessing(false);
      showToast(err.message || 'Error stopping recording', 'error');
    }
  };

  // Discard Recording
  const handleDiscardRecording = async () => {
    if (window.electronAPI && recordingResult?.tempFilePath) {
      await window.electronAPI.discardRecording({ tempFilePath: recordingResult.tempFilePath });
    }
    setRecordingResult(null);
    showToast('Clip discarded', 'info');
  };

  // Save Config
  const handleSaveConfig = async (newConfig: AppConfig) => {
    setConfig(newConfig);
    if (window.electronAPI) {
      await window.electronAPI.saveConfig(newConfig);
      showToast('Settings saved', 'success');
    }
  };

  // Audio/theme changes persist quietly (no toast per slider tick).
  const handleAudioChange = (patch: Partial<AppConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    window.electronAPI?.saveConfig(next);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (!isRecording && !recordingResult) {
          handleStartRecording();
        }
      } else if (e.key === 'p' || e.key === 'P') {
        if (isRecording) {
          if (isPaused) handleResumeRecording();
          else handlePauseRecording();
        }
      } else if (e.code === 'Escape') {
        if (isSettingsOpen) setIsSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, isPaused, recordingResult, isSettingsOpen]);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  const ToastIcon = toastMessage?.type === 'error' ? XCircle : toastMessage?.type === 'success' ? CheckCircle2 : Info;
  const toastColor = toastMessage?.type === 'error' ? 'var(--color-error)' : toastMessage?.type === 'success' ? 'var(--color-success)' : 'var(--color-primary)';

  return (
    <div className="app">
      {toastMessage && (
        <div className="toast" role={toastMessage.type === 'error' ? 'alert' : 'status'}>
          <ToastIcon size={16} color={toastColor} />
          {toastMessage.text}
        </div>
      )}

      <Header
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={setSelectedDeviceId}
        onRefreshDevices={fetchDevices}
        isLoadingDevices={isLoadingDevices}
        isRecording={isRecording}
        isPaused={isPaused}
        onOpenSettings={() => setIsSettingsOpen(true)}
        selectedDevice={selectedDevice}
        isBrowser={config.source === 'browser'}
        theme={config.theme}
        onThemeChange={(theme: ThemeMode) => handleAudioChange({ theme })}
      />

      <div className="app-body">
        <AudioPanel
          config={config}
          onChange={handleAudioChange}
          onOpenBrowser={async () => {
            const res = await window.electronAPI?.openBrowser();
            if (res && !res.success) showToast(res.error || 'Could not open the page', 'error');
          }}
          isRecording={isRecording}
          micDevices={mic.devices}
          micLevel={mic.level}
          micError={mic.error}
        />

        <main className="stage">
          {config.source === 'browser' ? (
            <div className="stage-canvas">
              <div className="card" style={{ padding: '24px', maxWidth: '360px', textAlign: 'center' }}>
                <Globe size={24} color="var(--color-primary)" aria-hidden />
                <h2 style={{ margin: '8px 0 4px' }}>Browser recording</h2>
                <p className="text-secondary">
                  Use the site in the <strong>AVD Studio Browser</strong> window. It renders at{' '}
                  {config.browserOutWidth}×{config.browserOutHeight}, so the video is sharp even though the window is small.
                </p>
                <p className="text-sm text-tertiary" style={{ marginTop: '8px' }}>F5 reloads · Alt+← goes back</p>
              </div>
            </div>
          ) : (
          <DevicePreview
            selectedDevice={selectedDevice}
            isRecording={isRecording}
            isPaused={isPaused}
            bitrate={config.defaultBitrate}
            fps={config.defaultFps}
          />
          )}
          <RecordingControls
            isRecording={isRecording}
            isPaused={isPaused}
            isProcessing={isProcessing}
            onStart={handleStartRecording}
            onPause={handlePauseRecording}
            onResume={handleResumeRecording}
            onStop={handleStopRecording}
            bitrate={config.defaultBitrate}
            fps={config.defaultFps}
            segmentCount={segmentCount}
            hasDevice={config.source === 'browser' || devices.length > 0}
            micEnabled={config.micEnabled}
            micLevel={mic.level}
          />
        </main>
      </div>

      {recordingResult && (
        <SaveExportModal
          result={recordingResult}
          onClose={() => setRecordingResult(null)}
          onDiscard={handleDiscardRecording}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          config={config}
          onSave={handleSaveConfig}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
