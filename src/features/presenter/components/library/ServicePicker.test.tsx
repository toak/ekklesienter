import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ServicePicker from './ServicePicker';

describe('ServicePicker UI Component', () => {
    it('should render selection dropdowns cleanly', () => {
        render(<ServicePicker onSelect={vi.fn()} currentServiceId={null} onClose={vi.fn()} />);
        expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
});

