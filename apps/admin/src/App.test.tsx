import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('shows the staff login when signed out', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Grid Admin' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });
});
