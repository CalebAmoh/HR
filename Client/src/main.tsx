import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App.tsx';
import './index.css';
import '@fontsource/syne/400.css';
import '@fontsource/syne/500.css';
import '@fontsource/syne/600.css';
import '@fontsource/syne/700.css';
import '@fontsource/syne/800.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toaster
      position="top-right"
      offset={16}
      gap={8}
      toastOptions={{
        duration: 3500,
        style: {
          fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
          fontSize: '13px',
          fontWeight: '500',
          borderRadius: '12px',
          padding: '14px 16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.09), 0 1px 6px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          color: '#111827',
          minWidth: '280px',
          maxWidth: '360px',
        },
      }}
    />
    <App />
  </StrictMode>,
);
