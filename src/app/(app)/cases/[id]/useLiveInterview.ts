"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveInterview,
  type Caption,
  type LiveStatus,
} from "@/lib/practice-live/client";
import { PRACTICE_START_EVENT, type LiveCue } from "@/lib/practice-live/protocol";

/**
 * React state for one voice practice session on /cases/[id]. Wraps the
 * framework-free LiveInterview engine; a fresh engine per start(). Audio
 * levels bypass React: every frame they're written as the `--cd-mic` /
 * `--cd-ai` CSS variables on the two meter elements (`micMeterRef`,
 * `aiMeterRef`), so the meters move without re-rendering — or restyling —
 * the rest of the card.
 */
export function useLiveInterview(caseId: string) {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [muted, setMuted] = useState(false);
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const engineRef = useRef<LiveInterview | null>(null);
  const micMeterRef = useRef<HTMLSpanElement | null>(null);
  const aiMeterRef = useRef<HTMLSpanElement | null>(null);

  // Release the mic and socket when the page unmounts mid-session.
  useEffect(() => () => engineRef.current?.dispose(), []);

  // Session clock: ticks while connected; freezes on end/error.
  const running = status === "live" || status === "reconnecting";
  useEffect(() => {
    if (!running || startedAt === null) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [running, startedAt]);

  const clearSession = useCallback(() => {
    setError(null);
    setCaptions([]);
    setMuted(false);
    setInterviewerSpeaking(false);
    setStartedAt(null);
    setElapsedMs(0);
  }, []);

  const start = useCallback(() => {
    engineRef.current?.dispose();
    clearSession();
    const engine = new LiveInterview(caseId, {
      onStatus: (next, message) => {
        setStatus(next);
        setError(message);
      },
      onCaptions: setCaptions,
      onInterviewerSpeaking: setInterviewerSpeaking,
      onMuted: setMuted,
      onStarted: (at) => {
        setStartedAt(at);
        setElapsedMs(0);
      },
      onLevels: (mic, interviewer) => {
        micMeterRef.current?.style.setProperty("--cd-mic", mic.toFixed(3));
        aiMeterRef.current?.style.setProperty("--cd-ai", interviewer.toFixed(3));
      },
    });
    engineRef.current = engine;
    // Synchronous inside the click — the engine creates its AudioContext
    // here, which Safari only allows during a user gesture.
    engine.start();
    window.dispatchEvent(new Event(PRACTICE_START_EVENT));
  }, [caseId, clearSession]);

  /** Back to the idle card (after an ended or failed session). */
  const reset = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    setStatus("idle");
    clearSession();
  }, [clearSession]);

  /**
   * Hang up. Before the interviewer ever connected there's nothing to look
   * back on, so that's a cancel straight back to the idle card.
   */
  const end = useCallback(() => {
    if (startedAt === null) reset();
    else engineRef.current?.end();
  }, [startedAt, reset]);

  const toggleMute = useCallback(() => {
    engineRef.current?.setMuted(!muted);
  }, [muted]);

  const sendCue = useCallback(
    (cue: LiveCue) => engineRef.current?.sendCue(cue) ?? false,
    []
  );

  return {
    status,
    error,
    captions,
    muted,
    interviewerSpeaking,
    elapsedMs,
    micMeterRef,
    aiMeterRef,
    start,
    end,
    reset,
    toggleMute,
    sendCue,
  };
}
