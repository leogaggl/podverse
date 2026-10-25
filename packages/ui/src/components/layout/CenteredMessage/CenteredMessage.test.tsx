import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CenteredMessage } from './CenteredMessage';

afterEach(() => {
  cleanup();
});

describe('CenteredMessage', () => {
  it('renders the message as a status', () => {
    render(<CenteredMessage live="status">Account created</CenteredMessage>);

    expect(screen.getByRole('status').textContent).toContain('Account created');
  });

  it('renders a failure as an alert', () => {
    render(
      <CenteredMessage live="alert" tone="danger">
        Verification failed
      </CenteredMessage>
    );

    expect(screen.getByRole('alert').textContent).toContain('Verification failed');
  });
});
