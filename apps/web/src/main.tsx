import { tokens } from '@grid/ui-tokens';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { initSentry } from './lib/sentry';
import './index.css';

initSentry();

// Bridge the TS design tokens into CSS custom properties — index.css consumes
// var(--bg0), var(--purple), … exactly like the prototype stylesheet did.
const root = document.documentElement;
for (const [name, value] of Object.entries(tokens.color))
  root.style.setProperty(`--${name}`, value);
for (const [name, value] of Object.entries(tokens.alpha))
  root.style.setProperty(`--a-${name}`, value);
root.style.setProperty('--r', `${tokens.radius.r}px`);
root.style.setProperty('--rl', `${tokens.radius.rl}px`);
root.style.setProperty('--font', tokens.font.sans);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
