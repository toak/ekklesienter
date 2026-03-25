import React from 'react';
import { ISlideTransition } from '@/core/types';

const TileContent = React.memo(({ children }: { children: React.ReactNode }) => (
  <div className="w-full h-full overflow-hidden">
    {children}
  </div>
));

export const CheckerboardTransition: React.FC<{
  children: React.ReactNode;
  transition: ISlideTransition;
}> = ({ children, transition }) => {
  const rows = 9; // Perfectly square in 16:9
  const cols = 16;
  const cells = Array.from({ length: rows * cols });

  const duration = transition.duration;
  const maxDist = Math.sqrt(Math.pow((cols - 1) / 2, 2) + Math.pow((rows - 1) / 2, 2));

  return (
    <div
      className="transition-checkerboard-container w-full h-full grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        '--transition-duration': `${duration}s`
      } as React.CSSProperties}
    >
      {cells.map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const isB = (r + c) % 2 === 0;

        const dc = c - (cols - 1) / 2;
        const dr = r - (rows - 1) / 2;
        const dist = Math.sqrt(dc * dc + dr * dr);
        const staggerProgress = dist / maxDist; // 0 to 1

        const phaseDelay = isB ? 0 : duration * 0.15;
        const staggerDelay = staggerProgress * (duration * 0.3); // Even snappier
        const totalDelay = phaseDelay + staggerDelay;
        const cellDuration = duration * 0.55;

        return (
          <div
            key={i}
            className="transition-checkerboard-cell relative"
            style={{
              '--tile-delay': `${totalDelay.toFixed(3)}s`,
              '--tile-duration': `${cellDuration.toFixed(3)}s`,
              width: '100%',
              height: '100%',
              willChange: 'transform, opacity',
              transform: 'translateZ(0)',
              contain: 'paint',
            } as React.CSSProperties}
          >
            <div
              className="absolute pointer-events-none overflow-hidden"
              style={{
                width: `${cols * 100}%`,
                height: `${rows * 100}%`,
                left: `-${c * 100}%`,
                top: `-${r * 100}%`,
              }}
            >
              <TileContent>{children}</TileContent>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ComicDotsTransition: React.FC<{
  children: React.ReactNode;
  transition: ISlideTransition;
}> = ({ children, transition }) => {
  const rows = 9; // Perfectly square in 16:9
  const cols = 16;
  const cells = Array.from({ length: rows * cols });

  return (
    <div
      className="transition-comic-dots-container w-full h-full grid overflow-hidden"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        '--transition-duration': `${transition.duration}s`
      } as any}
    >
      {cells.map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;

        const sizeFactor = (c + (rows - 1 - r)) / (cols + rows - 2);
        const staggerFactor = (c + (rows - 1 - r)) / (cols + rows - 2);
        const delay = staggerFactor * transition.duration * 0.6;

        const dotPeak = 1.3 + sizeFactor * 0.2;

        return (
          <div
            key={i}
            className="relative overflow-hidden"
          >
            <div
              className="transition-comic-dot-cell absolute overflow-hidden"
              style={{
                '--tile-delay': `${delay.toFixed(3)}s`,
                '--dot-peak': dotPeak.toFixed(2),
                width: '100%',
                height: '100%',
                willChange: 'transform, opacity',
                transform: 'translateZ(0)',
              } as React.CSSProperties}
            >
              <div
                className="absolute pointer-events-none"
                style={{
                  width: `${cols * 100}%`,
                  height: `${rows * 100}%`,
                  left: `-${c * 100}%`,
                  top: `-${r * 100}%`,
                }}
              >
                <TileContent>{children}</TileContent>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const normalizeTransitionType = (type: string): string => {
  if (type.startsWith('slide-')) return 'slide';
  if (type.startsWith('push-')) return 'push';
  if (type.startsWith('pan-')) return 'pan';
  if (type.startsWith('zoom-')) return 'zoom';
  return type;
};

export const normalizeTransitionDirection = (type: string, direction?: string, reverse?: boolean): string => {
  let dir = direction;
  if (!dir) {
    if (type.endsWith('-up')) dir = 'top';
    else if (type.endsWith('-down')) dir = 'bottom';
    else if (type.endsWith('-left')) dir = 'left';
    else if (type.endsWith('-right')) dir = 'right';
    else if (type.endsWith('-in')) dir = 'in';
    else if (type.endsWith('-out')) dir = 'out';
    else dir = 'right';
  }

  if (reverse) {
    const opposites: Record<string, string> = {
      'top': 'bottom',
      'bottom': 'top',
      'left': 'right',
      'right': 'left',
      'in': 'out',
      'out': 'in'
    };
    return opposites[dir] || dir;
  }
  return dir;
};

export const getTransitionVariables = (transition: ISlideTransition, reverse?: boolean): React.CSSProperties => {
  const normalizedType = normalizeTransitionType(transition.type);
  const dir = normalizeTransitionDirection(transition.type, transition.direction, reverse);

  let tx = '0%';
  let ty = '0%';
  let s = '1';
  let op = '1';

  if (['slide', 'push', 'pan'].includes(normalizedType)) {
    const isBig = normalizedType !== 'pan';
    const offset = (dir === 'left' || dir === 'top')
      ? (isBig ? '100%' : '-10%')
      : (isBig ? '-100%' : '10%');

    if (dir === 'top' || dir === 'bottom') ty = offset;
    if (dir === 'left' || dir === 'right') tx = offset;
  }

  if (normalizedType === 'zoom') {
    s = dir === 'in' ? '0.5' : '1.5';
    op = '0';
  }

  if (normalizedType === 'slide') {
    s = '0.95';
  }

  return {
    '--transition-duration': `${transition.duration}s`,
    '--tx-start': tx,
    '--ty-start': ty,
    '--s-start': s,
    '--op-start': op,
  } as React.CSSProperties;
};
