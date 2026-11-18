// Browser source: renders a site off-screen at true device resolution (e.g. 390x866 CSS
// at DPR 2.77 = 1080x2400) and shows it in one normal window you click/scroll/type in.
// A visible window can't be used directly: the screen is smaller than the HD page.
const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

let osr = null;   // offscreen page that actually renders
let view = null;  // visible window showing it
let opts = null;  // { url, width, height, outWidth }
let lastFrame = null;
let lastFrameAt = 0;
let framesSeen = 0;
const sinks = new Set(); // recording chunks receiving JPEG frames
let pointerSink = null;  // cursor samples while recording

function isOpen() {
  return !!(osr && !osr.isDestroyed() && view && !view.isDestroyed());
}

function closeBrowser() {
  if (view && !view.isDestroyed()) view.destroy();
  if (osr && !osr.isDestroyed()) osr.destroy();
  view = osr = null;
  lastFrame = null;
}

async function openBrowser(next) {
  const same = isOpen() && opts && opts.width === next.width && opts.height === next.height && opts.outWidth === next.outWidth;
  if (same) {
    if (next.url && next.url !== opts.url) await osr.loadURL(next.url);
    opts = next;
    view.show();
    view.focus();
    return { success: true };
  }
  closeBrowser();
  opts = next;
  const { width, height, outWidth } = next;

  osr = new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    enableLargerThanScreen: true,
    webPreferences: { offscreen: { deviceScaleFactor: outWidth / width }, partition: 'persist:avd-browser' }
  });
  osr.setContentSize(width, height); // Windows clamps hidden windows to the screen; force it back
  osr.webContents.setFrameRate(60);
  osr.webContents.setUserAgent(MOBILE_UA);
  osr.webContents.setWindowOpenHandler(({ url }) => {
    osr.loadURL(url); // keep popups in the same page
    return { action: 'deny' };
  });

  const fit = Math.min(1, (screen.getPrimaryDisplay().workArea.height - 48) / height);
  view = new BrowserWindow({
    useContentSize: true,
    width: Math.round(width * fit),
    height: Math.round(height * fit),
    resizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    title: 'AVD Studio Browser',
    backgroundColor: '#000000',
    webPreferences: { preload: path.join(__dirname, 'browser-preload.cjs'), contextIsolation: true }
  });
  view.on('page-title-updated', (e) => e.preventDefault());
  view.on('closed', closeBrowser);
  view.loadFile(path.join(__dirname, 'browser-view.html'));

  osr.webContents.on('cursor-changed', (_e, type) => {
    if (view && !view.isDestroyed()) view.webContents.send('browser:cursor', type);
  });

  const dbg = osr.webContents.debugger;
  dbg.attach('1.3');
  dbg.on('message', (_e, method, params) => {
    if (method !== 'Page.screencastFrame') return;
    dbg.sendCommand('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {});
    lastFrame = Buffer.from(params.data, 'base64');
    lastFrameAt = Date.now();
    framesSeen++;
    if (view && !view.isDestroyed()) view.webContents.send('browser:frame', lastFrame);
    for (const sink of sinks) sink(lastFrame);
  });

  try {
    await osr.loadURL(next.url);
  } catch (err) {
    // Navigation errors still leave a page to show; report but keep the window.
    console.error('[browser] load failed:', err.message);
  }
  // Exact viewport (Windows rounds window sizes) + mobile behaviour, like DevTools device mode.
  // Must come after the first load: applying it to a blank offscreen page crashes Chromium.
  await dbg.sendCommand('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: outWidth / width, mobile: true });
  // JPEG q80 looks identical to q92 at this resolution but encodes much faster:
  // ~49 vs ~33 frames/s while scrolling + recording (measured).
  await dbg.sendCommand('Page.startScreencast', { format: 'jpeg', quality: next.jpegQuality || 80, everyNthFrame: 1 });
  return { success: true };
}

// Chromium only sends frames when the page changes; repeat the last one so a still page
// still fills the recording (ffmpeg's fps filter can't extend past the last frame).
setInterval(() => {
  if (lastFrame && sinks.size && Date.now() - lastFrameAt > 200) for (const sink of sinks) sink(lastFrame);
}, 200);

// Input from the visible window. Positions arrive as fractions of the view, so the
// on-screen scale doesn't matter.
ipcMain.on('browser:input', (_e, ev) => {
  if (!isOpen()) return;
  if (ev.type === 'leave') {
    pointerSink?.({ t: Date.now(), hidden: true });
    return;
  }
  const out = { ...ev };
  if ('rx' in ev) {
    out.x = Math.round(ev.rx * opts.width);
    out.y = Math.round(ev.ry * opts.height);
    delete out.rx;
    delete out.ry;
    pointerSink?.({ t: Date.now(), x: out.x, y: out.y, w: opts.width, h: opts.height });
  }
  if (ev.type === 'mouseDown') osr.webContents.focus();
  osr.webContents.sendInputEvent(out);
});

ipcMain.handle('browser:nav', async (_e, cmd) => {
  if (!isOpen()) return false;
  const wc = osr.webContents;
  if (cmd === 'reload') wc.reload();
  else if (cmd === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  else if (cmd === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  return true;
});

// One recording chunk: JPEG frames -> ffmpeg (wall-clock timestamps, constant fps, H.264).
// Returns a child process with gracefulStop(), so the session can treat it like scrcpy.
// Prefer the GPU encoder (NVIDIA NVENC) so live encoding doesn't steal CPU from rendering.
// Checked once by encoding one test frame; falls back to x264 on machines without it.
let encoderCheck = null;
function pickEncoder(ffmpegPath) {
  encoderCheck ??= new Promise((resolve) => {
    const p = spawn(ffmpegPath, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=1080x2400:d=0.1', '-c:v', 'h264_nvenc', '-f', 'null', '-'], { windowsHide: true });
    p.on('error', () => resolve('x264'));
    p.on('close', (code) => resolve(code === 0 ? 'nvenc' : 'x264'));
  });
  return encoderCheck;
}

function startBrowserChunk(chunkPath, { ffmpegPath, fps, outWidth, outHeight, onStart, cursorChunk, encoder = 'x264' }) {
  const ff = spawn(ffmpegPath, [
    '-y', '-use_wallclock_as_timestamps', '1', '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', '-',
    // Chromium's JPEGs are full-range BT.601. Convert to standard TV-range BT.709 and tag it:
    // left as full-range, most players read it as TV-range and light greys blow out to white.
    '-vf', `fps=${fps},scale=${outWidth}:${outHeight}:flags=lanczos:in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709`,
    // ponytail: realtime CPU encode; ultrafast keeps up at 1080x2400@60, files are larger.
    ...(encoder === 'nvenc'
      ? ['-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', '19', '-b:v', '0']
      : ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16']),
    '-pix_fmt', 'yuv420p',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', chunkPath
  ], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  ff.stderr.on('data', () => {});
  ff.stdin.on('error', () => {});

  let started = false;
  const sink = (buf) => {
    if (!started) {
      started = true;
      if (cursorChunk) cursorChunk.t0 = Date.now();
      onStart();
    }
    if (ff.stdin.writable) ff.stdin.write(buf);
  };
  if (cursorChunk) pointerSink = (s) => cursorChunk.samples.push(s);
  sinks.add(sink);
  if (lastFrame) sink(lastFrame); // start immediately even if the page is still

  ff.gracefulStop = () => new Promise((resolve) => {
    sinks.delete(sink);
    pointerSink = null;
    const timer = setTimeout(resolve, 20000);
    ff.once('close', () => { clearTimeout(timer); resolve(); });
    ff.stdin.end();
  });
  return ff;
}

module.exports = { openBrowser, closeBrowser, isBrowserOpen: isOpen, startBrowserChunk, pickEncoder, framesSeen: () => framesSeen };
