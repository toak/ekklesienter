import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: React.forwardRef(({ children, ...props }: any, ref: any) => (
            <div { ...props } ref = { ref } > { children } </div>
        )),
    span: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <span { ...props } ref = { ref } > { children } </span>
    )),
    button: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <button { ...props } ref = { ref } > { children } </button>
    )),
article: React.forwardRef(({ children, ...props }: any, ref: any) => (
    <article { ...props } ref = { ref } > { children } </article>
)),
section: React.forwardRef(({ children, ...props }: any, ref: any) => (
    <section { ...props } ref = { ref } > { children } </section>
)),
h1: React.forwardRef(({ children, ...props }: any, ref: any) => (
    <h1 { ...props } ref = { ref } > { children } </h1>
)),
h2: React.forwardRef(({ children, ...props }: any, ref: any) => (
    <h2 { ...props } ref = { ref } > { children } </h2>
)),
h3: React.forwardRef(({ children, ...props }: any, ref: any) => (
    <h3 { ...props } ref = { ref } > { children } </h3>
)),
  },
AnimatePresence: ({ children }: any) => <>{ children } </>,
useAnimation: () => ({
    start: vi.fn(),
    stop: vi.fn(),
}),
    useInView: () => [vi.fn(), true],
}));

// Mock Lucide icons
vi.mock('lucide-react', async () => {
    const actual = await vi.importActual('lucide-react');
    return {
        ...actual,
        // Add specific icon mocks if needed, or use a proxy
        default: vi.fn(),
    };
});

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            changeLanguage: () => Promise.resolve(),
            language: 'en',
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

// Mock Electron
vi.stubGlobal('electron', {
    ipcRenderer: {
        invoke: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
    },
});
