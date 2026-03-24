import React from 'react';
import { ICanvasItem } from '@/core/types';

interface ShapeRendererProps {
  item: ICanvasItem;
  idPrefix: string;
}

export const ShapeRenderer: React.FC<ShapeRendererProps> = ({ item, idPrefix }) => {
  const shape = item.shape || { shapeType: 'rect' };
  const clipId = `clip-${idPrefix}-${item.id}`;

  const getSVGPath = () => {
    const getRadii = () => {
      if (item.lockBorderRadius !== false) {
        const r = item.borderRadius || 0;
        return { tl: r, tr: r, br: r, bl: r };
      }
      return {
        tl: item.borderRadiusTL || 0,
        tr: item.borderRadiusTR || 0,
        br: item.borderRadiusBR || 0,
        bl: item.borderRadiusBL || 0,
      };
    };

    switch (shape.shapeType) {
      case 'circle': return <circle cx="50" cy="50" r="48" />;
      case 'triangle': return <polygon points="50,2 98,98 2,98" />;
      case 'star': return <polygon points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" />;
      case 'diamond': return <polygon points="50,2 98,50 50,98 2,50" />;
      case 'rect':
      default: return <RoundedRect x={0} y={0} width={100} height={100} radii={getRadii()} />;
    }
  };

  return (
    <div className="w-full h-full relative" style={{ clipPath: `url(#${clipId})`, WebkitClipPath: `url(#${clipId})` }}>
      <svg className="absolute inset-0 w-0 h-0 pointer-events-none">
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <g transform="scale(0.01, 0.01)">
              {getSVGPath()}
            </g>
          </clipPath>
        </defs>
      </svg>
    </div>
  );
};

// --- SVG Rounded Rect Helper ---

export const RoundedRect: React.FC<{
  x: number | string,
  y: number | string,
  width: number | string,
  height: number | string,
  radii: { tl: number, tr: number, br: number, bl: number },
  className?: string,
  fill?: string,
  stroke?: string,
  strokeWidth?: number | string
}> = ({ x, y, width, height, radii, ...props }) => {
  const rx = typeof x === 'number' ? x : 0;
  const ry = typeof y === 'number' ? y : 0;
  const rw = typeof width === 'number' ? width : 100;
  const rh = typeof height === 'number' ? height : 100;

  if (radii.tl === radii.tr && radii.tr === radii.br && radii.br === radii.bl) {
    return <rect x={x} y={y} width={width} height={height} rx={radii.tl} {...props} />;
  }

  const { tl, tr, br, bl } = radii;
  const path = `
    M ${rx + tl},${ry}
    h ${rw - tl - tr}
    a ${tr},${tr} 0 0 1 ${tr},${tr}
    v ${rh - tr - br}
    a ${br},${br} 0 0 1 -${br},${br}
    h -${rw - br - bl}
    a ${bl},${bl} 0 0 1 -${bl},-${bl}
    v -${rh - bl - tl}
    a ${tl},${tl} 0 0 1 ${tl},-${tl}
    z
  `;

  return <path d={path} {...props} />;
};
