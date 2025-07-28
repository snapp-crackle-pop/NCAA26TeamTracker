'use client';
import * as React from 'react';

export function TimelineControl({
  baseSeason,
  timeOffset,
  onOffsetChange,
}: {
  baseSeason: number;
  timeOffset: number;
  onOffsetChange: (offset: number) => void;
}) {
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      onOffsetChange(timeOffset >= 5 ? 0 : timeOffset + 1);
    }, 1200);
    return () => window.clearInterval(id);
  }, [playing, timeOffset, onOffsetChange]);

  return (
    // overlay-friendly: no top border; compact spacing
    <div className="px-3 py-2 flex items-center gap-2 text-sm">
      <button onClick={() => setPlaying((p) => !p)} className="btn text-sm w-8 h-8">
        {playing ? '❚❚' : '▶'}
      </button>

      <div className="flex gap-2 items-center ml-2">
        {Array.from({ length: 6 }, (_, i) => i).map((i) => (
          <button
            key={i}
            onClick={() => onOffsetChange(i)}
            className="btn text-xs"
            style={{
              minWidth: 48,
              background:
                i === timeOffset
                  ? 'color-mix(in oklab, var(--foreground) 14%, transparent)'
                  : 'transparent',
            }}
            title={i === 0 ? 'now' : `t+${i}`}
          >
            {i === 0 ? '★' : `t+${i}`}
          </button>
        ))}
      </div>

      <div className="ml-auto text-xs opacity-70">
        t = {timeOffset >= 0 ? `+${timeOffset}` : timeOffset} · {baseSeason + timeOffset}
      </div>
    </div>
  );
}