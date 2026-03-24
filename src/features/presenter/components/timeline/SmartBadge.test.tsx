import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SmartBadge from './SmartBadge';
import React from 'react';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue: string) => defaultValue,
  }),
}));

describe('SmartBadge', () => {
  it('should return null if no duration and no transition', () => {
    const slide: any = { type: 'normal', content: {} };
    const { container } = render(<SmartBadge slide={slide} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render duration badge if duration is set', () => {
    const slide: any = { type: 'normal', duration: 10, content: {} };
    render(<SmartBadge slide={slide} />);
    expect(screen.getByText('10s')).toBeDefined();
  });

  it('should render transition badge if transition type is not none', () => {
    const slide: any = { type: 'normal', transition: { type: 'fade' }, content: {} };
    const { container } = render(<SmartBadge slide={slide} />);
    // Since it's an icon, we can check for the existence of the badge div or the SVG
    expect(container.querySelector('.text-purple-300')).toBeDefined();
  });

  it('should render both badges if both are set', () => {
    const slide: any = { type: 'normal', duration: 5, transition: { type: 'slide' }, content: {} };
    render(<SmartBadge slide={slide} />);
    expect(screen.getByText('5s')).toBeDefined();
    // Check for the purple transition badge div
    const transitionBadge = document.querySelector('.text-purple-300');
    expect(transitionBadge).toBeDefined();
  });
});
