import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { FontPrewarmer } from '@/features/presenter/components/fonts/FontPrewarmer';
import PromptModal from '@/shared/ui/modals/PromptModal';
import ConfirmModal from '@/shared/ui/modals/ConfirmModal';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import ProjectorView from '@/features/presenter/components/display/ProjectorView';
import { ControllerLayout } from './layouts/ControllerLayout';
import { useWakeLock } from '@/features/presenter/hooks/useWakeLock';

/**
 * Main App Entry Point.
 * Handles high-level routing and global provider setup.
 * The core controller logic and layout are decoupled into separate components.
 */
const App: React.FC = () => {
  useWakeLock();

  return (
    <ErrorBoundary>
      <HashRouter>
        {/* Global UI Providers */}
        <Toaster position="top-center" expand={false} visibleToasts={5} />
        <FontPrewarmer />
        <PromptModal />
        <ConfirmModal />

        {/* Core Application Routing */}
        <Routes>
          <Route path="/" element={<ControllerLayout />} />
          <Route path="/projector" element={<ProjectorView />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;