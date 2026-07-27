"use client";

interface Props {
  isRecording: boolean;
  duration: number;
  onStart: () => void;
  onStop: () => void;
}

export default function VoiceRecorderButton({ isRecording, duration, onStart, onStop }: Props) {
  return (
    <button
      onMouseDown={onStart}
      onMouseUp={onStop}
      onMouseLeave={() => isRecording && onStop()}
      onTouchStart={(e) => { e.preventDefault(); onStart(); }}
      onTouchEnd={(e) => { e.preventDefault(); onStop(); }}
      className={`voice-btn ${isRecording ? "recording" : ""}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isRecording ? "red" : "currentColor"} strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>
      {isRecording && <span className="duration">{duration}s</span>}
    </button>
  );
}