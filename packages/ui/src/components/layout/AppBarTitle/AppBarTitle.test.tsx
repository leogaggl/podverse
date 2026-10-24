import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MainHeader } from '../MainHeader/MainHeader';
import { AppBarTitleProvider, useAppBarTitle } from './AppBarTitle';

afterEach(() => {
  cleanup();
});

function TitleProbe() {
  const title = useAppBarTitle();
  return <output data-testid="probe">{title === null ? 'none' : title}</output>;
}

function Harness({ first, second }: { first?: string; second?: string }) {
  return (
    <AppBarTitleProvider>
      <TitleProbe />
      {first !== undefined ? <MainHeader title={first} /> : null}
      {second !== undefined ? <MainHeader title={second} /> : null}
    </AppBarTitleProvider>
  );
}

function probeText(): string | null {
  return screen.getByTestId('probe').textContent;
}

describe('AppBarTitle', () => {
  it('publishes the MainHeader title, follows prop changes, and clears on unmount', () => {
    const { rerender } = render(<Harness first="Settings" />);
    expect(probeText()).toBe('Settings');

    rerender(<Harness first="Browse" />);
    expect(probeText()).toBe('Browse');

    rerender(<Harness />);
    expect(probeText()).toBe('none');
  });

  it('keeps the newer title when the earlier header unmounts after it', () => {
    const { rerender } = render(<Harness first="Settings" />);
    rerender(<Harness first="Settings" second="Browse" />);
    expect(probeText()).toBe('Browse');

    rerender(<Harness second="Browse" />);
    expect(probeText()).toBe('Browse');
  });
});
