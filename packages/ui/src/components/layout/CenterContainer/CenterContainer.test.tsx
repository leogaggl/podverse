import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CenterContainer } from './CenterContainer';

afterEach(() => {
  cleanup();
});

describe('CenterContainer', () => {
  it('renders children in a div by default', () => {
    render(<CenterContainer data-testid="center">Sign in</CenterContainer>);

    const frame = screen.getByTestId('center');
    expect(frame.tagName).toBe('DIV');
    expect(frame.textContent).toContain('Sign in');
  });

  it('renders a named main when asked', () => {
    render(
      <CenterContainer aria-label="Taste Profile" as="main" surface="primary">
        Agreement
      </CenterContainer>
    );

    expect(screen.getByRole('main', { name: 'Taste Profile' }).textContent).toContain('Agreement');
  });
});
