import React from 'react';
import { ICanvasItem } from '@/core/types';

interface EffectRendererProps {
  effect: NonNullable<ICanvasItem['effect']>;
}

export const EffectRenderer: React.FC<EffectRendererProps> = ({ effect }) => {
  switch (effect.effectType) {
    case 'glow':
      return <div className="w-full h-full rounded-full" style={{ background: `radial-gradient(circle, ${effect.color} 0%, transparent 70%)` }} />;
    case 'shadow':
      return <div className="w-full h-full rounded-2xl" style={{ boxShadow: `0 0 ${effect.intensity}px ${effect.color}` }} />;
    case 'blur':
      return <div className="w-full h-full" style={{ backdropFilter: `blur(${effect.intensity / 5}px)`, background: effect.color }} />;
    case 'vignette':
      return <div className="w-full h-full" style={{ background: `radial-gradient(ellipse, transparent 40%, ${effect.color} 100%)` }} />;
    default:
      return null;
  }
};
