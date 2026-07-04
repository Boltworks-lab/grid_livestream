import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { AuthProvider } from './auth/AuthContext';

describe('App', () => {
  it('shows the auth screen when signed out', () => {
    render(
      <AuthProvider>
        <App />
      </AuthProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Grid' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Create account' })).toBeTruthy();
  });
});
