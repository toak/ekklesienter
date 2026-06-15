import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTemplatePickerData } from './useTemplatePickerData';

describe('useTemplatePickerData custom hooks', () => {
    it('should query system-defined presentation designs list', () => {
        const { result } = renderHook(() => useTemplatePickerData());
        expect(result.current).toBeDefined();
    });
});
