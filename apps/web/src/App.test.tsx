import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { AuthProvider } from './auth/AuthContext';

describe('App', () => {
  it('shows the auth screen when signed out', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Grid' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Create account' })).toBeTruthy();
  });
});
