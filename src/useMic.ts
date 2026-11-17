import { useCallback, useEffect, useRef, useState } from 'react';

// -------------------------------------------------------------
// useMic: PC microphone capture with live gain, mute and level meter.
// Graph: source -> gain -> (analyser, MediaStreamDestination -> MediaRecorder).
// Only the source node is swapped on device change, so a running recording
// survives switching mics or toggling the mic off (records silence).
// -------------------------------------------------------------
export function useMic(enabled: boolean, deviceId: string, volume: number, muted: boolean) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const graph = useRef<{
    ctx: AudioContext;
    gain: GainNode;
    analyser: AnalyserNode;
    dest: MediaStreamAudioDestinationNode;
  } | null>(null);
  const source = useRef<{ node: MediaStreamAudioSourceNode; stream: MediaStream } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getGraph = () => {
    if (!graph.current) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const dest = ctx.createMediaStreamDestination();
      gain.connect(analyser);
      gain.connect(dest);
      graph.current = { ctx, gain, analyser, dest };
    }
    return graph.current;
  };

  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    setDevices(all.filter((d) => d.kind === 'audioinput'));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async read of an external device list
    refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
  }, [refreshDevices]);

  // (Re)connect the selected input whenever enabled/device changes.
  useEffect(() => {
    let cancelled = false;
    const disconnect = () => {
      source.current?.node.disconnect();
      source.current?.stream.getTracks().forEach((t) => t.stop());
      source.current = null;
    };

    if (!enabled) {
      disconnect();
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        disconnect();
        const g = getGraph();
        const node = g.ctx.createMediaStreamSource(stream);
        node.connect(g.gain);
        g.ctx.resume();
        source.current = { node, stream };
        setError(null);
        refreshDevices(); // labels become available after permission
      })
      .catch((e) => setError(e.message || 'Microphone unavailable'));

    return () => {
      cancelled = true;
    };
  }, [enabled, deviceId, refreshDevices]);

  useEffect(() => {
    getGraph().gain.gain.value = muted ? 0 : volume;
  }, [volume, muted]);

  // Level meter (post-gain, so it reflects volume/mute).
  useEffect(() => {
    if (!enabled) return;
    const { analyser } = getGraph();
    const buf = new Float32Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v));
      setLevel((prev) => Math.max(peak, prev * 0.85)); // smooth decay
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  // Start/resume the mic recorder once scrcpy actually starts writing a chunk.
  const go = useCallback(() => {
    if (waitTimer.current) clearTimeout(waitTimer.current);
    waitTimer.current = null;
    const r = recorder.current;
    if (r?.state === 'inactive') r.start(1000);
    else if (r?.state === 'paused') r.resume();
  }, []);

  useEffect(() => window.electronAPI?.onRecordingStarted(go), [go]);

  // ponytail: 4s fallback if scrcpy never logs "Recording started"; sync is approximate either way.
  const waitForVideo = () => {
    if (waitTimer.current) clearTimeout(waitTimer.current);
    waitTimer.current = setTimeout(go, 4000);
  };

  /** Call right after the video recording is requested. No-op when mic is off. */
  const arm = () => {
    if (!enabled) return;
    const g = getGraph();
    g.ctx.resume();
    chunks.current = [];
    const r = new MediaRecorder(g.dest.stream, { mimeType: 'audio/webm;codecs=opus' });
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    recorder.current = r;
    waitForVideo();
  };

  const pause = () => {
    if (recorder.current?.state === 'recording') recorder.current.pause();
  };

  const expectResume = () => {
    if (recorder.current?.state === 'paused') waitForVideo();
  };

  /** Stops and returns the recorded mic track, or null if nothing was recorded. */
  const stop = (): Promise<ArrayBuffer | null> => {
    if (waitTimer.current) clearTimeout(waitTimer.current);
    const r = recorder.current;
    recorder.current = null;
    if (!r || r.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      r.onstop = async () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        resolve(blob.size ? await blob.arrayBuffer() : null);
      };
      r.stop();
    });
  };

  return { devices, level: enabled ? level : 0, error, arm, pause, expectResume, stop };
}
