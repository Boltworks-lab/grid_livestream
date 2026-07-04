import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the admin shell heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Grid Admin' })).toBeTruthy();
  });
});
