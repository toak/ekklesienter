import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { LoadingScreen } from './LoadingScreen';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

describe('LoadingScreen UI Component', () => {
    it('should render loading overlay containers', () => {
        const { container } = render(<LoadingScreen />);
        expect(container).toBeDefined();
    });
});

