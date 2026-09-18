/**
 * SwasthyaSync — Sarvam AI Speech-to-Text Hook (Fixed & Optimized)
 *
 * Fixes:
 *  1. Touch+mouse double-fire — preventDefault on touch events stops the
 *     mouse event from also firing, which was calling startRecording() twice.
 *  2. Result callback ref pattern — avoids stale closure / re-render loop
 *     where useEffect re-fired with old lastResult.
 *  3. Minimum recording duration — prevents accidental tap-release being
 *     sent as empty audio.
 *  4. Audio level monitoring — visual feedback that mic is picking up sound.
 *  5. Size guard — sends audio bytes count to backend log for debugging.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { getApiBaseUrl } from '../config';

export interface STTResult {
  transcript: string;
  language_code: string;
  language_name: string;
  error?: string;
}

interface UseSarvamSTTReturn {
  isRecording: boolean;
  startRecording: (e?: React.TouchEvent | React.MouseEvent) => Promise<void>;
  stopRecording: (e?: React.TouchEvent | React.MouseEvent) => void;
  lastResult: STTResult | null;
  error: string | null;
  audioLevel: number; // 0-1, for visualizing mic input
}

const BACKEND_URL = getApiBaseUrl();
const MIN_RECORDING_MS = 500; // Don't send audio shorter than this

export function useSarvamSTT(
  hintLanguage: string = 'hi-IN',
  onResult?: (result: STTResult) => void,
): UseSarvamSTTReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [lastResult, setLastResult] = useState<STTResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const onResultRef = useRef(onResult);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  // Keep callback ref up to date without triggering re-renders
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  // Monitor audio level while recording
  const startAudioLevelMonitor = useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 128); // Normalize to 0-1
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch {
      // AudioContext not critical — ignore errors
    }
  }, []);

  const stopAudioLevelMonitor = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const startRecording = useCallback(async (e?: React.TouchEvent | React.MouseEvent) => {
    // CRITICAL FIX: Prevent touch events from also firing mouse events
    if (e && 'touches' in e) {
      e.preventDefault();
    }

    // Don't start if already recording
    if (mediaRecorderRef.current?.state === 'recording') return;

    setError(null);
    setLastResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startAudioLevelMonitor(stream);

      let mimeType = 'audio/webm';
      let extension = 'webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
        extension = 'webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
        extension = 'mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
        extension = 'ogg';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stopAudioLevelMonitor();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIsRecording(false);

        const duration = Date.now() - startTimeRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeType });

        console.log(`[STT] Recording stopped: ${duration}ms, ${blob.size} bytes, mimeType=${mimeType}`);

        if (duration < MIN_RECORDING_MS || blob.size < 200) {
          console.warn('[STT] Recording too short or empty — skipping send');
          return;
        }

        try {
          const formData = new FormData();
          formData.append('audio', blob, `recording.${extension}`);
          formData.append('language', hintLanguage);

          console.log(`[STT] Sending to backend: ${blob.size} bytes, language=${hintLanguage}`);
          const t0 = Date.now();

          const response = await fetch(`${BACKEND_URL}/api/stt`, {
            method: 'POST',
            body: formData,
          });

          console.log(`[STT] Backend responded in ${Date.now() - t0}ms`);

          if (!response.ok) throw new Error(`STT failed: ${response.status}`);
          const result: STTResult = await response.json();

          console.log(`[STT] Transcript: "${result.transcript}" | lang=${result.language_code}`);

          if (result.transcript) {
            setLastResult(result);
            // Use callback ref to avoid stale closure issues
            onResultRef.current?.(result);
          } else if (result.error) {
            // Surface the actual API error (e.g., model deprecated, auth error)
            console.error('[STT] API error:', result.error);
            setError(`STT error: ${result.error}`);
          } else {
            console.warn('[STT] Empty transcript — mic may not have picked up speech');
            setError('Could not hear clearly — please speak louder or try again');
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'STT request failed';
          console.error('[STT] Error:', msg);
          setError(msg);
        }
      };

      recorder.start(200); // Collect chunks every 200ms
      setIsRecording(true);
      console.log('[STT] Recording started');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      console.error('[STT] Start error:', msg);
      setError(msg);
    }
  }, [hintLanguage, startAudioLevelMonitor, stopAudioLevelMonitor]);

  const stopRecording = useCallback((e?: React.TouchEvent | React.MouseEvent) => {
    // CRITICAL FIX: Prevent touch events from also firing mouse events
    if (e && 'touches' in e) {
      e.preventDefault();
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      console.log('[STT] Stop requested');
    }
  }, []);

  return { isRecording, startRecording, stopRecording, lastResult, error, audioLevel };
}
