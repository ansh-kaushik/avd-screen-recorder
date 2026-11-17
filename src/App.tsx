import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DevicePreview } from './components/DevicePreview';
import { RecordingControls } from './components/RecordingControls';
import { SaveExportModal } from './components/SaveExportModal';
import { SettingsModal } from './components/SettingsModal';
import type { AndroidDevice, AppConfig, RecordingResult } from './types';

const DEFAULT_CONFIG: AppConfig = {
  scrcpyPath: 'C:\\Users\\anshk\\Desktop\\dt\\Desktop6_work\\AVD_SCREEN_RECORDER\\scrcpy\\scrcpy.exe',
  ffmpegPath: 'C:\\ffmpeg\\bin\\ffmpeg.exe',
  adbPath: 'C:\\Users\\anshk\\Desktop\\dt\\Desktop6_work\\AVD_SCREEN_RECORDER\\scrcpy\\adb.exe',
  defaultSaveDir: 'C:\\Users\\anshk\\Desktop\\dt\\Desktop6_work\\Editing\\media\\app clips\\tutorials',
  defaultBitrate: '20M',
  defaultFps: 60,
  audioEnabled: true,
  audioSource: 'playback',
  stayAwake: true
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
    if (!selectedDeviceId && devices.length === 0) {
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
      const res = await window.electronAPI.stopRecording();
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

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 200,
          background: toastMessage.type === 'error'
            ? 'rgba(239, 68, 68, 0.95)'
            : toastMessage.type === 'success'
            ? 'rgba(16, 185, 129, 0.95)'
            : 'rgba(30, 41, 59, 0.95)',
          color: '#fff',
          padding: '8px 18px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)'
        }}>
          {toastMessage.text}
        </div>
      )}

      {/* Top Header */}
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
      />

      {/* Main Center Studio Canvas Preview */}
      <DevicePreview
        selectedDevice={selectedDevice}
        isRecording={isRecording}
        isPaused={isPaused}
        bitrate={config.defaultBitrate}
        fps={config.defaultFps}
      />

      {/* Floating Bottom Recording Dock */}
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
        hasDevice={devices.length > 0}
      />

      {/* Post-Capture Save & Export Modal */}
      {recordingResult && (
        <SaveExportModal
          result={recordingResult}
          onClose={() => setRecordingResult(null)}
          onDiscard={handleDiscardRecording}
        />
      )}

      {/* Settings Modal */}
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
