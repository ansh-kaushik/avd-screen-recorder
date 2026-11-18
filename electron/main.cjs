const { app, BrowserWindow, ipcMain, dialog, shell, desktopCapturer, protocol, net, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { pathToFileURL } = require('url');
const { spawn, exec } = require('child_process');
const { openBrowser, startBrowserChunk } = require('./browser.cjs');

// Register custom protocol for local media playback
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
]);

const BUNDLED_SCRCPY = path.join(__dirname, '../scrcpy/scrcpy.exe');
const BUNDLED_ADB = path.join(__dirname, '../scrcpy/adb.exe');

function getValidBundledScrcpy() {
  const possible = [
    BUNDLED_SCRCPY,
    path.join(app.getAppPath(), 'scrcpy/scrcpy.exe'),
    'C:\\Users\\anshk\\Desktop\\dt\\Desktop6_work\\AVD_SCREEN_RECORDER\\scrcpy\\scrcpy.exe',
    'C:\\Users\\anshk\\Desktop\\scrcpy-win64-v4.1\\scrcpy.exe'
  ];
  for (const p of possible) {
    if (fs.existsSync(p)) return p;
  }
  return 'scrcpy';
}

function getValidBundledAdb() {
  const possible = [
    BUNDLED_ADB,
    path.join(app.getAppPath(), 'scrcpy/adb.exe'),
    'C:\\Users\\anshk\\Desktop\\dt\\Desktop6_work\\AVD_SCREEN_RECORDER\\scrcpy\\adb.exe',
    'C:\\Users\\anshk\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe',
    'C:\\platform-tools\\adb.exe'
  ];
  for (const p of possible) {
    if (fs.existsSync(p)) return p;
  }
  return 'adb';
}

const DEFAULT_CONFIG = {
  scrcpyPath: getValidBundledScrcpy(),
  ffmpegPath: 'C:\\ffmpeg\\bin\\ffmpeg.exe',
  adbPath: getValidBundledAdb(),
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

const CONFIG_FILE = path.join(app.getPath('userData'), 'avd_recorder_config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const loaded = JSON.parse(data);
      // Auto-heal scrcpyPath or adbPath if old cached path is dead
      if (loaded.scrcpyPath && !fs.existsSync(loaded.scrcpyPath)) {
        loaded.scrcpyPath = getValidBundledScrcpy();
      }
      if (loaded.adbPath && !fs.existsSync(loaded.adbPath)) {
        loaded.adbPath = getValidBundledAdb();
      }
      return { ...DEFAULT_CONFIG, ...loaded };
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(newConfig) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save config:', err);
    return false;
  }
}

function resolveScrcpyBin() {
  const config = loadConfig();
  if (config.scrcpyPath && fs.existsSync(config.scrcpyPath)) return config.scrcpyPath;
  return getValidBundledScrcpy();
}

function resolveAdbBin() {
  const config = loadConfig();
  if (config.adbPath && fs.existsSync(config.adbPath)) return config.adbPath;
  return getValidBundledAdb();
}

function resolveFfmpegBin() {
  const config = loadConfig();
  if (config.ffmpegPath && fs.existsSync(config.ffmpegPath)) return `"${config.ffmpegPath}"`;
  return 'ffmpeg';
}

let mainWindow = null;
let currentSession = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#f5f5f5',
    title: 'AVD Studio',
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  const devUrl = 'http://localhost:5173';

  const req = http.get(devUrl, (res) => {
    if (res.statusCode === 200) {
      mainWindow.loadURL(devUrl);
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  });

  req.on('error', () => {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupCurrentSession();
  });
}

// Win32 cursor tracker. Prints "dpi N" once, then "<unixMs> <x> <y> <clientW> <clientH>"
// whenever the cursor moves relative to the emulator window's client area (which is
// exactly the device screen), or "<unixMs> hidden" when the window is minimized/gone.
const CURSOR_TRACKER_PS = `
Add-Type @"
using System; using System.Text; using System.Threading; using System.Runtime.InteropServices;
public static class CT {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr h);
  struct RECT { public int L, T, R, B; } struct POINT { public int X, Y; }
  static IntPtr Find(string port) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      var sb = new StringBuilder(256); GetWindowText(h, sb, 256); var t = sb.ToString();
      if (IsWindowVisible(h) && t.StartsWith("Android Emulator") && t.EndsWith(":" + port)) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
  public static void Run(string port) {
    SetProcessDPIAware();
    IntPtr h = IntPtr.Zero; string last = ""; bool dpiSent = false;
    while (true) {
      if (!IsWindow(h)) h = Find(port);
      string line;
      if (h == IntPtr.Zero || IsIconic(h)) line = "hidden";
      else {
        if (!dpiSent) { Console.Out.WriteLine("dpi " + GetDpiForWindow(h)); dpiSent = true; }
        POINT c; GetCursorPos(out c); RECT r; GetClientRect(h, out r); POINT o = new POINT(); ClientToScreen(h, ref o);
        line = (c.X - o.X) + " " + (c.Y - o.Y) + " " + r.R + " " + r.B;
      }
      if (line != last) { Console.Out.WriteLine(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + " " + line); Console.Out.Flush(); last = line; }
      Thread.Sleep(15);
    }
  }
}
"@
[CT]::Run($env:AVD_EMU_PORT)
`;

function startCursorTracker(deviceId, chunk) {
  const port = (deviceId.match(/^emulator-(\d+)$/) || [])[1];
  if (!port) return; // only emulators have a desktop window to track
  const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', CURSOR_TRACKER_PS], {
    windowsHide: true,
    env: { ...process.env, AVD_EMU_PORT: port }
  });
  let buf = '';
  ps.stdout.on('data', (d) => {
    buf += d.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const l of lines) parseTrackerLine(l, chunk);
  });
  ps.stderr.on('data', (d) => console.error(`[cursor tracker] ${d}`));
  chunk.tracker = ps;
}

function parseTrackerLine(line, chunk) {
  const p = line.trim().split(' ');
  if (p[0] === 'dpi') chunk.dpi = Number(p[1]) || 96;
  else if (p[1] === 'hidden') chunk.samples.push({ t: Number(p[0]), hidden: true });
  else if (p.length === 5) chunk.samples.push({ t: Number(p[0]), x: +p[1], y: +p[2], w: +p[3], h: +p[4] });
}

// Per-chunk wiring. scrcpy logs "Recording started" once the first packets hit
// the file: the renderer starts/resumes the mic on it, and it is t=0 for the cursor.
function attachChunk(proc, chunkPath, config) {
  const chunk = { t0: null, dpi: 96, samples: [], tracker: null };
  if (config.showCursor) {
    currentSession.cursor[chunkPath] = chunk;
    startCursorTracker(currentSession.deviceId, chunk);
  }
  proc.stderr.on('data', (d) => {
    const text = d.toString();
    console.log(`[scrcpy err] ${text}`);
    if (text.includes('Recording started')) {
      chunk.t0 = Date.now();
      if (mainWindow) mainWindow.webContents.send('record:started');
    }
  });
  proc.on('close', () => {
    try { chunk.tracker?.kill(); } catch (e) {}
  });
}

// Options shared by every recording chunk (start and resume).
function captureArgs(config) {
  const args = ['--no-playback'];
  if (config.stayAwake) args.push('--stay-awake');
  // Android's own touch indicators; emulator mouse clicks arrive as touches.
  if (config.showTouches) args.push('--show-touches');
  return args;
}

function cleanupCurrentSession() {
  if (currentSession && currentSession.activeProcess) {
    try {
      currentSession.activeProcess.kill('SIGINT');
    } catch (e) {}
  }
  currentSession = null;
}

// Send a REAL Ctrl+C to a child on Windows. Node's proc.kill('SIGINT') just
// calls TerminateProcess (hard kill), so scrcpy never writes the .mp4 trailer
// (moov atom) and the file is unplayable. This attaches to the child's own
// (hidden) console and raises CTRL_C_EVENT so scrcpy finalizes the recording.
function sendCtrlC(pid) {
  return new Promise((resolve) => {
    const ps = `
$sig = @"
using System;
using System.Runtime.InteropServices;
public static class W {
  [DllImport("kernel32.dll")] public static extern bool AttachConsole(uint p);
  [DllImport("kernel32.dll")] public static extern bool FreeConsole();
  [DllImport("kernel32.dll")] public static extern bool SetConsoleCtrlHandler(IntPtr h, bool a);
  [DllImport("kernel32.dll")] public static extern bool GenerateConsoleCtrlEvent(uint e, uint g);
}
"@
Add-Type $sig
[W]::FreeConsole() | Out-Null
if ([W]::AttachConsole(${pid})) {
  [W]::SetConsoleCtrlHandler([IntPtr]::Zero, $true) | Out-Null
  [W]::GenerateConsoleCtrlEvent(0, 0) | Out-Null
  Start-Sleep -Milliseconds 300
  [W]::FreeConsole() | Out-Null
}
`;
    const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true });
    p.on('close', () => resolve(true));
    p.on('error', () => resolve(false));
  });
}

// Gracefully stop a scrcpy chunk: Ctrl+C, wait for it to finalize + exit, then
// hard-kill as a last resort. Returns once the process is really gone.
async function stopScrcpyGracefully(proc) {
  if (proc && proc.gracefulStop) return proc.gracefulStop(); // browser chunk (ffmpeg)
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  let exited = false;
  proc.once('close', () => { exited = true; });

  if (process.platform === 'win32' && proc.pid) {
    await sendCtrlC(proc.pid);
  } else {
    try { proc.kill('SIGINT'); } catch (e) {}
  }

  // Give scrcpy up to ~3s to write the trailer and exit on its own.
  for (let i = 0; i < 30 && !exited; i++) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (!exited) {
    try { proc.kill(); } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
  }
}

// -------------------------------------------------------------
// IPC Handlers
// -------------------------------------------------------------

// 1. Get Config
ipcMain.handle('config:get', async () => {
  return loadConfig();
});

// 2. Save Config
function browserOptions(config) {
  return {
    url: config.browserUrl,
    width: Number(config.browserWidth) || 390,
    height: Number(config.browserHeight) || 866,
    outWidth: Number(config.browserOutWidth) || 1080
  };
}

ipcMain.handle('browser:open', async () => {
  try {
    return await openBrowser(browserOptions(loadConfig()));
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Browser source chunk: frames from the off-screen page -> ffmpeg.
async function startBrowserSessionChunk(chunkPath, config) {
  await openBrowser(browserOptions(config));
  const cursorChunk = config.showCursor ? { t0: null, dpi: 96, samples: [], tracker: null } : null;
  if (cursorChunk) currentSession.cursor[chunkPath] = cursorChunk;
  return startBrowserChunk(chunkPath, {
    ffmpegPath: config.ffmpegPath && fs.existsSync(config.ffmpegPath) ? config.ffmpegPath : 'ffmpeg',
    fps: currentSession.maxFps,
    outWidth: Number(config.browserOutWidth) || 1080,
    outHeight: Number(config.browserOutHeight) || 2400,
    cursorChunk,
    onStart: () => { if (mainWindow) mainWindow.webContents.send('record:started'); }
  });
}

ipcMain.handle('config:save', async (_, config) => {
  return saveConfig(config);
});

// 3. List Connected Android Devices
ipcMain.handle('device:list', async () => {
  const adb = resolveAdbBin();
  const adbCmd = adb.includes(' ') ? `"${adb}"` : adb;

  return new Promise((resolve) => {
    exec(`${adbCmd} devices -l`, async (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, error: stderr || err.message, devices: [] });
        return;
      }

      const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
      const devices = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('* daemon') || line.startsWith('List of')) continue;

        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const id = parts[0];
          const state = parts[1];
          const isEmulator = id.startsWith('emulator-') || id.includes('qemu');

          let model = 'Unknown Android';
          const modelMatch = line.match(/model:(\S+)/);
          if (modelMatch) model = modelMatch[1].replace(/_/g, ' ');

          let resolution = '1080x2400';
          try {
            const sizeOut = await new Promise((r) => {
              exec(`${adbCmd} -s ${id} shell wm size`, { timeout: 1500 }, (e, out) => {
                if (!e && out) {
                  const m = out.match(/Physical size:\s*(\d+x\d+)/);
                  if (m) r(m[1]);
                  else r('1080x2400');
                } else {
                  r('1080x2400');
                }
              });
            });
            resolution = sizeOut;
          } catch (e) {}

          devices.push({
            id,
            state,
            isEmulator,
            model,
            resolution
          });
        }
      }

      resolve({ success: true, devices });
    });
  });
});

// 4. Capture Fast Screenshot Data URL
ipcMain.handle('device:screenshot', async (_, deviceId) => {
  const adb = resolveAdbBin();
  const adbCmd = adb.includes(' ') ? `"${adb}"` : adb;
  const targetId = deviceId ? `-s ${deviceId}` : '';

  return new Promise((resolve) => {
    exec(`${adbCmd} ${targetId} exec-out screencap -p`, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, timeout: 3000 }, (err, stdout) => {
      if (err || !stdout || stdout.length < 100) {
        resolve({ success: false, error: err ? err.message : 'Empty frame' });
        return;
      }
      const base64 = stdout.toString('base64');
      resolve({ success: true, dataUrl: `data:image/png;base64,${base64}` });
    });
  });
});

// 5. Get Desktop Window Sources for WebRTC Live Preview
ipcMain.handle('screen:getSources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 400, height: 400 },
      fetchWindowIcons: true
    });

    const formatted = sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      isEmulator: /emulator|android|qemu|pixel|scrcpy/i.test(s.name)
    }));

    return { success: true, sources: formatted };
  } catch (err) {
    return { success: false, error: err.message, sources: [] };
  }
});

// 6. Start Recording Session
ipcMain.handle('record:start', async (_, options = {}) => {
  const config = loadConfig();
  const {
    deviceId = '',
    bitrate = config.defaultBitrate || '20M',
    maxFps = config.defaultFps || 60,
    audioEnabled = config.audioEnabled !== false,
    audioSource = config.audioSource || 'playback',
    source = config.source || 'device'
  } = options;

  if (currentSession && currentSession.isRecording) {
    return { success: false, error: 'A recording session is already active.' };
  }

  const scrcpyBin = resolveScrcpyBin();
  if (!fs.existsSync(scrcpyBin) && scrcpyBin !== 'scrcpy') {
    return { success: false, error: `scrcpy executable not found at: ${scrcpyBin}` };
  }

  const sessionId = `session_${Date.now()}`;
  const tempDir = path.join(os.tmpdir(), 'avd_recordings', sessionId);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  currentSession = {
    sessionId,
    tempDir,
    deviceId,
    bitrate,
    maxFps,
    audioEnabled,
    audioSource,
    chunkIndex: 1,
    chunks: [],
    startTime: Date.now(),
    isRecording: true,
    isPaused: false,
    activeProcess: null,
    cursor: {},
    source
  };

  const chunkPath = path.join(tempDir, `chunk_001.mp4`);
  currentSession.chunks.push(chunkPath);

  if (source === 'browser') {
    try {
      currentSession.activeProcess = await startBrowserSessionChunk(chunkPath, config);
      return { success: true, sessionId, chunkIndex: 1, tempDir, startTime: currentSession.startTime };
    } catch (err) {
      currentSession = null;
      return { success: false, error: err.message };
    }
  }

  const args = [
    '--record', chunkPath,
    `--video-bit-rate=${bitrate}`,
    `--max-fps=${maxFps}`
  ];

  if (deviceId) {
    args.unshift('-s', deviceId);
  }

  if (!audioEnabled) {
    args.push('--no-audio');
  } else if (audioSource) {
    args.push(`--audio-source=${audioSource}`);
  }

  args.push(...captureArgs(config));

  console.log(`Spawning scrcpy: ${scrcpyBin}`, args);

  try {
    const proc = spawn(scrcpyBin, args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    proc.on('error', (err) => {
      console.error('[scrcpy spawn error]:', err);
    });

    currentSession.activeProcess = proc;

    proc.stdout.on('data', (d) => console.log(`[scrcpy out] ${d.toString()}`));
    attachChunk(proc, chunkPath, config);

    proc.on('close', (code) => {
      console.log(`scrcpy chunk finished with code ${code}`);
    });

    return {
      success: true,
      sessionId,
      chunkIndex: 1,
      tempDir,
      startTime: currentSession.startTime
    };
  } catch (err) {
    currentSession = null;
    return { success: false, error: err.message };
  }
});

// 7. Pause Recording Session
ipcMain.handle('record:pause', async () => {
  if (!currentSession || !currentSession.isRecording || currentSession.isPaused) {
    return { success: false, error: 'No active recording to pause.' };
  }

  const proc = currentSession.activeProcess;
  currentSession.isPaused = true;
  currentSession.activeProcess = null;

  await stopScrcpyGracefully(proc);

  return { success: true, isPaused: true, chunkCount: currentSession.chunks.length };
});

// 8. Resume Recording Session (New chunk)
ipcMain.handle('record:resume', async () => {
  if (!currentSession || !currentSession.isRecording || !currentSession.isPaused) {
    return { success: false, error: 'Recording is not paused.' };
  }

  const config = loadConfig();
  const scrcpyBin = resolveScrcpyBin();
  currentSession.chunkIndex += 1;
  const chunkName = `chunk_${String(currentSession.chunkIndex).padStart(3, '0')}.mp4`;
  const chunkPath = path.join(currentSession.tempDir, chunkName);
  currentSession.chunks.push(chunkPath);

  if (currentSession.source === 'browser') {
    try {
      currentSession.activeProcess = await startBrowserSessionChunk(chunkPath, config);
      currentSession.isPaused = false;
      return { success: true, isPaused: false, chunkIndex: currentSession.chunkIndex };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  const args = [
    '--record', chunkPath,
    `--video-bit-rate=${currentSession.bitrate}`,
    `--max-fps=${currentSession.maxFps}`
  ];

  if (currentSession.deviceId) {
    args.unshift('-s', currentSession.deviceId);
  }

  if (!currentSession.audioEnabled) {
    args.push('--no-audio');
  } else if (currentSession.audioSource) {
    args.push(`--audio-source=${currentSession.audioSource}`);
  }

  args.push(...captureArgs(config));

  try {
    const proc = spawn(scrcpyBin, args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    proc.on('error', (err) => {
      console.error('[scrcpy resume spawn error]:', err);
    });

    currentSession.activeProcess = proc;
    currentSession.isPaused = false;

    proc.stdout.on('data', (d) => console.log(`[scrcpy out] ${d.toString()}`));
    attachChunk(proc, chunkPath, config);

    return { success: true, isPaused: false, chunkIndex: currentSession.chunkIndex };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 9. Stop Recording and Process Final Video
ipcMain.handle('record:stop', async (_, { micAudio = null, deviceVolume = 1 } = {}) => {
  if (!currentSession) {
    return { success: false, error: 'No active session.' };
  }

  const session = { ...currentSession };
  const proc = currentSession.activeProcess;
  currentSession.isRecording = false;
  currentSession.activeProcess = null;

  await stopScrcpyGracefully(proc);

  const config = loadConfig();
  const ffmpegBin = resolveFfmpegBin();

  let validChunks = session.chunks.filter(c => fs.existsSync(c) && fs.statSync(c).size > 1024);

  const withCursor = [];
  for (const c of validChunks) {
    withCursor.push(session.cursor[c] ? await overlayCursor(ffmpegBin, c, session.cursor[c], session.maxFps) : c);
  }
  validChunks = withCursor;

  if (validChunks.length === 0) {
    currentSession = null;
    return { success: false, error: 'No video data was recorded. Please ensure the emulator is active.' };
  }

  const finalVideoPath = path.join(session.tempDir, 'processed_master.mp4');

  if (validChunks.length === 1) {
    try {
      fs.copyFileSync(validChunks[0], finalVideoPath);
    } catch (err) {
      return { success: false, error: `Failed to copy video: ${err.message}` };
    }
  } else {
    const concatListPath = path.join(session.tempDir, 'concat_list.txt');
    const concatContent = validChunks.map(c => `file '${c.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent, 'utf-8');

    const concatCmd = `${ffmpegBin} -y -f concat -safe 0 -i "${concatListPath}" -c copy "${finalVideoPath}"`;
    console.log(`Running FFmpeg concat: ${concatCmd}`);

    await new Promise((res) => {
      exec(concatCmd, (err, stdout, stderr) => {
        if (err) {
          console.error('Concat error:', stderr);
          fs.copyFileSync(validChunks[0], finalVideoPath);
        }
        res(true);
      });
    });
  }

  await mixAudio(ffmpegBin, session.tempDir, finalVideoPath, micAudio, deviceVolume);

  let fileSize = 0;
  let thumbnailDataUrl = null;

  if (fs.existsSync(finalVideoPath)) {
    fileSize = fs.statSync(finalVideoPath).size;

    const thumbPath = path.join(session.tempDir, 'thumbnail.jpg');
    await new Promise((res) => {
      exec(`${ffmpegBin} -y -ss 00:00:01 -i "${finalVideoPath}" -vframes 1 -q:v 2 "${thumbPath}"`, () => {
        if (fs.existsSync(thumbPath)) {
          const buf = fs.readFileSync(thumbPath);
          thumbnailDataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
        }
        res(true);
      });
    });
  }

  return {
    success: true,
    sessionId: session.sessionId,
    tempFilePath: finalVideoPath,
    fileSize,
    chunkCount: validChunks.length,
    thumbnailDataUrl,
    defaultSaveDir: config.defaultSaveDir
  };
});

function runFfmpeg(cmd) {
  return new Promise((res) => exec(cmd, (err, _o, stderr) => {
    if (err) console.error('FFmpeg error:', stderr);
    res(!err);
  }));
}

function probeVideoSize(ffmpegBin, file) {
  return new Promise((res) => exec(`${ffmpegBin} -hide_banner -i "${file}"`, (_e, _o, stderr) => {
    const m = /Video:.*?, (\d{2,5})x(\d{2,5})/.exec(stderr || '');
    const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(stderr || '');
    const duration = d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0;
    res(m ? { w: +m[1], h: +m[2], duration } : null);
  }));
}

// Tracked cursor samples -> sendcmd keyframes (seconds, video px). Pure, so it's testable.
// cursor.png is a 4x arrow with its hotspot at (4,4).
function cursorCommands(chunk, video) {
  const lines = [];
  for (const s of chunk.samples) {
    const t = Math.max(0, (s.t - chunk.t0) / 1000);
    if (t === 0 && lines.length) lines.pop(); // only the latest pre-start position matters at t=0
    let x = -9999, y = -9999;
    if (!s.hidden && s.w > 0 && s.h > 0 && s.x >= 0 && s.y >= 0 && s.x < s.w && s.y < s.h) {
      const k = (video.w / s.w) * (chunk.dpi / 96) / 4; // cursor scale in the video
      x = Math.round((s.x * video.w) / s.w - 4 * k);
      y = Math.round((s.y * video.h) / s.h - 4 * k);
    }
    lines.push(`${t.toFixed(3)} overlay@c x ${x}, overlay@c y ${y};`);
  }
  return lines;
}

// Draw the PC cursor onto one chunk (re-encodes video, copies audio). Returns the path to use.
async function overlayCursor(ffmpegBin, chunkPath, chunk, fps = 60) {
  const first = chunk.samples.find((s) => s.w > 0);
  if (chunk.t0 === null || !first) return chunkPath;
  const video = await probeVideoSize(ffmpegBin, chunkPath);
  if (!video || !video.duration) return chunkPath;

  const dir = path.dirname(chunkPath);
  const base = path.basename(chunkPath, '.mp4');
  const cmdFile = `${base}_cursor.cmd`; // relative: ffmpeg runs with cwd=dir (avoids C: escaping)
  fs.writeFileSync(path.join(dir, cmdFile), cursorCommands(chunk, video).join('\n'), 'utf-8');

  const k = (video.w / first.w) * (chunk.dpi / 96) / 4;
  const out = path.join(dir, `${base}_cursor.mp4`);
  const cursorPng = path.join(__dirname, 'cursor.png');
  // scrcpy video is variable-rate (no frames while the screen is still), so resample to a
  // constant rate first; otherwise the cursor could only move when the app redraws.
  // tpad repeats the last frame so a still screen still lasts the whole chunk.
  const graph = `[0:v]tpad=stop_mode=clone:stop_duration=${video.duration.toFixed(3)},fps=${Number(fps) || 60},sendcmd=f=${cmdFile}[v];[1:v]scale=iw*${k.toFixed(4)}:-1[c];[v][c]overlay@c=x=-9999:y=-9999:eval=frame[o]`;
  // ponytail: CPU re-encode (libx264 veryfast); switch to h264_nvenc/qsv if long clips are too slow.
  const cmd = `${ffmpegBin} -y -i "${chunkPath}" -i "${cursorPng}" -filter_complex "${graph}" -map "[o]" -map 0:a? -t ${video.duration.toFixed(3)} -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -c:a copy "${out}"`;
  const ok = await new Promise((res) => exec(cmd, { cwd: dir, maxBuffer: 16 * 1024 * 1024 }, (err, _o, stderr) => {
    if (err) console.error('Cursor overlay error:', stderr);
    res(!err);
  }));
  return ok && fs.existsSync(out) ? out : chunkPath;
}

// Mix the PC mic track (already gain/mute-adjusted in the renderer) and apply
// device-audio volume. Video is stream-copied; only audio is re-encoded.
async function mixAudio(ffmpegBin, tempDir, videoPath, micAudio, deviceVolume) {
  const dv = Math.max(0, Math.min(2, Number(deviceVolume) || 0)).toFixed(2);
  if (!micAudio && Number(dv) === 1) return;

  const out = path.join(tempDir, 'mixed.mp4');
  const enc = `-c:v copy -c:a aac -b:a 192k "${out}"`;
  let ok;

  if (micAudio) {
    const micPath = path.join(tempDir, 'mic.webm');
    fs.writeFileSync(micPath, Buffer.from(micAudio));
    const inputs = `${ffmpegBin} -y -i "${videoPath}" -i "${micPath}"`;
    ok = await runFfmpeg(`${inputs} -filter_complex "[0:a]volume=${dv}[d];[d][1:a]amix=inputs=2:duration=first:normalize=0[a]" -map 0:v -map "[a]" ${enc}`);
    // No device audio track in the video (audio off / unsupported) -> mic only.
    if (!ok) ok = await runFfmpeg(`${inputs} -map 0:v -map 1:a -shortest ${enc}`);
  } else {
    ok = await runFfmpeg(`${ffmpegBin} -y -i "${videoPath}" -filter:a volume=${dv} ${enc}`);
  }

  if (ok && fs.existsSync(out)) fs.renameSync(out, videoPath);
}

// 10. Get Media URL for robust HTML5 video playback
ipcMain.handle('video:getDataUrl', async (_, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return { success: false, error: 'File not found' };
  }
  try {
    // Return standard file URL with 3 slashes
    const fileUrl = pathToFileURL(filePath).href;
    return { success: true, url: fileUrl };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 11. Save and Export Recording to Target Directory
ipcMain.handle('record:save', async (_, payload) => {
  const {
    tempFilePath,
    fileName,
    destinationFolder,
    title = '',
    category = 'Tutorial',
    tags = [],
    description = '',
    keepTemp = false
  } = payload;

  if (!tempFilePath || !fs.existsSync(tempFilePath)) {
    return { success: false, error: 'Source recorded file not found.' };
  }

  const config = loadConfig();
  const targetDir = destinationFolder || config.defaultSaveDir;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let sanitizedName = (fileName || `avd_recording_${Date.now()}`).trim();
  if (!sanitizedName.toLowerCase().endsWith('.mp4')) {
    sanitizedName += '.mp4';
  }

  sanitizedName = sanitizedName.replace(/[<>:"/\\|?*]/g, '_');

  const targetPath = path.join(targetDir, sanitizedName);
  const jsonPath = path.join(targetDir, sanitizedName.replace(/\.mp4$/i, '.json'));

  try {
    fs.copyFileSync(tempFilePath, targetPath);

    const metadata = {
      title: title || sanitizedName,
      fileName: sanitizedName,
      category,
      tags,
      description,
      recordedAt: new Date().toISOString(),
      sizeBytes: fs.statSync(targetPath).size,
      filePath: targetPath
    };

    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2), 'utf-8');

    const tempDir = path.dirname(tempFilePath);
    if (!keepTemp && tempDir.includes('avd_recordings')) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
    }

    currentSession = null;

    return {
      success: true,
      savedPath: targetPath,
      metadataPath: jsonPath,
      fileName: sanitizedName,
      folder: targetDir
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 12. Discard Recording & Cleanup Temp
ipcMain.handle('record:discard', async (_, payload) => {
  const { tempFilePath } = payload || {};
  if (tempFilePath && fs.existsSync(tempFilePath)) {
    const tempDir = path.dirname(tempFilePath);
    if (tempDir.includes('avd_recordings')) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
    }
  }
  currentSession = null;
  return { success: true };
});

// 13. Directory Chooser Dialog
ipcMain.handle('dialog:selectDirectory', async (_, defaultPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: defaultPath || loadConfig().defaultSaveDir
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// 14. Open Item in Windows File Explorer
ipcMain.handle('system:openFolder', async (_, targetPath) => {
  if (!targetPath) return false;
  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      shell.openPath(targetPath);
    } else {
      shell.showItemInFolder(targetPath);
    }
    return true;
  }
  return false;
});

// -------------------------------------------------------------
// App Lifecycle
// -------------------------------------------------------------

app.whenReady().then(() => {
  // Register local-media custom protocol handler
  protocol.handle('local-media', (request) => {
    // Convert local-media://path to real file URL
    const decodedUrl = decodeURIComponent(request.url.replace(/^local-media:\/\//, ''));
    // Ensure Windows drive path format: C:/...
    const normalizedPath = decodedUrl.startsWith('/') ? decodedUrl.slice(1) : decodedUrl;
    const fileUrl = pathToFileURL(normalizedPath).toString();
    return net.fetch(fileUrl);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
