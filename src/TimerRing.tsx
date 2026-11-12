interface TimerRingProps {
  value: string;
  label: string;
  running?: boolean;
}

export function TimerRing({ value, label, running = true }: TimerRingProps) {
  return (
    <div className={`timer-ring ${running ? 'is-running' : 'is-complete'}`} role="timer" aria-label={`${label}: ${value}`}>
      <div className="timer-ring-dial">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="timer-ring-track" cx="50" cy="50" r="44" />
          <circle className="timer-ring-arc" cx="50" cy="50" r="44" />
        </svg>
        <strong>{value}</strong>
      </div>
      <span>{label}</span>
    </div>
  );
}
