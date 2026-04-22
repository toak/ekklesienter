import React from 'react';
import { ICanvasItem, IStyleLayer } from '@/core/types';
import { RoundedRect } from './ShapeRenderer';
import { SlideBackground } from '../../display/SlideBackground';

interface StrokeRendererProps {
  item: ICanvasItem;
  strokes: IStyleLayer[];
  align: 'inside' | 'center' | 'outside';
  idPrefix: string;
}

export const StrokeRenderer: React.FC<StrokeRendererProps> = ({ item, strokes, align, idPrefix }) => {
  const borderWidth = item.borderWidth || 0;
  const maskId = `stroke-mask-${idPrefix}-${item.id}`;

  const getRadii = (offset = 0) => {
    if (item.lockBorderRadius !== false) {
      const r = (item.borderRadius || 0) + offset;
      return { tl: r, tr: r, br: r, bl: r };
    }
    return {
      tl: Math.max(0, (item.borderRadiusTL || 0) + offset),
      tr: Math.max(0, (item.borderRadiusTR || 0) + offset),
      br: Math.max(0, (item.borderRadiusBR || 0) + offset),
      bl: Math.max(0, (item.borderRadiusBL || 0) + offset),
    };
  };

  const radii = getRadii();
  const expansion = align === 'outside' ? borderWidth : align === 'center' ? borderWidth / 2 : 0;
  const strokeJoin = item.strokeJoin || 'round';
  const dashArray = item.strokeDashArray || undefined;

  return (
    <div className="absolute overflow-visible pointer-events-none" style={{
      inset: -expansion,
      width: `calc(100% + ${expansion * 2}px)`,
      height: `calc(100% + ${expansion * 2}px)`,
    }}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" overflow="visible">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse">
            <g>
              {align === 'outside' ? (
                <>
                  <RoundedRect x={0} y={0} width="100%" height="100%" radii={getRadii(expansion)} fill="white" />
                  <RoundedRect x={expansion} y={expansion} width={`calc(100% - ${expansion * 2}px)`} height={`calc(100% - ${expansion * 2}px)`} radii={radii} fill="black" />
                </>
              ) : align === 'inside' ? (
                <>
                  <RoundedRect x={0} y={0} width="100%" height="100%" radii={radii} fill="white" />
                  <RoundedRect x={borderWidth} y={borderWidth} width={`calc(100% - ${borderWidth * 2}px)`} height={`calc(100% - ${borderWidth * 2}px)`} radii={getRadii(-borderWidth)} fill="black" />
                </>
              ) : (
                <RoundedRect
                  x={expansion} y={expansion}
                  width={`calc(100% - ${expansion * 2}px)`} height={`calc(100% - ${expansion * 2}px)`}
                  radii={radii} fill="none" stroke="white" strokeWidth={borderWidth}
                  strokeLinejoin={strokeJoin} strokeLinecap={item.strokeLinecap} strokeDasharray={dashArray}
                />
              )}
            </g>
          </mask>
        </defs>
      </svg>
      <div
        className="absolute inset-0"
        style={{
          mask: `url(#${maskId})`,
          WebkitMask: `url(#${maskId})`,
        }}
      >
        <SlideBackground background={strokes} showOverlay={false} />
      </div>
    </div>
  );
};
