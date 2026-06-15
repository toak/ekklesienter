import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { PerformanceMonitor } from './PerformanceMonitor';

describe('PerformanceMonitor UI Component', () => {
    it('should render stats overlay monitors', () => {
        const { container } = render(<PerformanceMonitor />);
        expect(container).toBeDefined();
    });
});

