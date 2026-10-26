import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchInput } from './SearchInput';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SearchInput', () => {
  it('shows the clear button after the field has text', () => {
    render(<SearchInput clearButtonAriaLabel="Clear Search" onSearch={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Clear Search' })).toBeNull();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });

    expect(screen.getByRole('button', { name: 'Clear Search' })).toBeTruthy();
  });

  it('cancels a pending search and reports the empty term once', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<SearchInput clearButtonAriaLabel="Clear Search" onSearch={onSearch} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSearch.mock.calls).toEqual([['']]);
    const input = screen.getByRole('textbox');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Search field is not an input');
    }
    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Clear Search' })).toBeNull();
  });

  it('searches the typed term once, then the empty term once when cleared', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<SearchInput clearButtonAriaLabel="Clear Search" onSearch={onSearch} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }));

    expect(onSearch.mock.calls).toEqual([['abc'], ['']]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSearch.mock.calls).toEqual([['abc'], ['']]);
  });
});
