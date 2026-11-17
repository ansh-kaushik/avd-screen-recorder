export interface AndroidDevice {
  id: string;
  state: string;
  isEmulator: boolean;
  model: string;
  resolution: string;
}

export interface WindowSource {
  id: string;
  name: string;
  thumbnail: string;
  isEmulator: boolean;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppConfig {
  scrcpyPath: string;
  ffmpegPath: string;
  adbPath: string;
  defaultSaveDir: string;
  defaultBitrate: string;
  defaultFps: number;
  audioEnabled: boolean;
  audioSource: string;
  audioVolume: number;
  audioMuted: boolean;
  micEnabled: boolean;
  micDeviceId: string;
  micVolume: number;
  micMuted: boolean;
  stayAwake: boolean;
  theme: ThemeMode;
}

export interface RecordingResult {
  sessionId: string;
  tempFilePath: string;
  fileSize: number;
  chunkCount: number;
  thumbnailDataUrl?: string;
  defaultSaveDir: string;
}

export interface SavePayload {
  tempFilePath: string;
  fileName: string;
  destinationFolder?: string;
  title?: string;
  category?: string;
  tags?: string[];
  description?: string;
  keepTemp?: boolean;
}

export interface ElectronAPI {
  getConfig: () => Promise<AppConfig>;
  saveConfig: (config: AppConfig) => Promise<boolean>;

  listDevices: () => Promise<{ success: boolean; devices: AndroidDevice[]; error?: string }>;
  captureScreenshot: (deviceId?: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
  getScreenSources: () => Promise<{ success: boolean; sources: WindowSource[]; error?: string }>;

  startRecording: (options?: {
    deviceId?: string;
    bitrate?: string;
    maxFps?: number;
    audioEnabled?: boolean;
    audioSource?: string;
  }) => Promise<{ success: boolean; sessionId?: string; chunkIndex?: number; error?: string }>;

  pauseRecording: () => Promise<{ success: boolean; isPaused?: boolean; error?: string }>;
  resumeRecording: () => Promise<{ success: boolean; isPaused?: boolean; chunkIndex?: number; error?: string }>;
  onRecordingStarted: (cb: () => void) => () => void;
  stopRecording: (options?: { micAudio?: ArrayBuffer | null; deviceVolume?: number }) => Promise<{ success: boolean } & Partial<RecordingResult> & { error?: string }>;

  getVideoUrl: (filePath: string) => Promise<{ success: boolean; url?: string; error?: string }>;

  saveRecording: (payload: SavePayload) => Promise<{
    success: boolean;
    savedPath?: string;
    metadataPath?: string;
    fileName?: string;
    folder?: string;
    error?: string;
  }>;

  discardRecording: (payload?: { tempFilePath?: string }) => Promise<{ success: boolean }>;

  selectDirectory: (defaultPath?: string) => Promise<string | null>;
  openFolder: (targetPath: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
