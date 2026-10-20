import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImageRuntimeProvider } from '../ImageRuntime/ImageRuntime';
import { ImageNonReact } from './ImageNonReact';

import styles from './ImageNonReact.module.scss';

const runtime = {
  imageProxyEnabled: false,
  nextImageOptimizationEnabled: false,
  listGridSlotSize: 600,
  placeholderSrc: '/placeholder.png',
  proxyPathPrefix: '/api/proxy?url=',
} as const;

function placeholderClass(): string {
  if (styles.placeholder === undefined) {
    throw new Error('Expected the CSS module to define the placeholder class');
  }
  return styles.placeholder;
}

function renderWithRuntime(ui: ReactElement) {
  return render(<ImageRuntimeProvider {...runtime}>{ui}</ImageRuntimeProvider>);
}

afterEach(() => {
  cleanup();
});

describe('ImageNonReact', () => {
  it('draws the scaled placeholder once every candidate has failed', () => {
    renderWithRuntime(
      <ImageNonReact alt="Artwork" candidates={['https://cdn.example.com/a.jpg']} />
    );

    fireEvent.error(screen.getByAltText('Artwork'));

    const placeholder = screen.getByAltText('Artwork');
    expect(placeholder.getAttribute('src')).toBe('/placeholder.png');
    expect(placeholder.classList.contains(placeholderClass())).toBe(true);
  });

  it('draws the scaled placeholder when there are no candidates', () => {
    renderWithRuntime(<ImageNonReact alt="Artwork" candidates={[]} />);

    expect(screen.getByAltText('Artwork').classList.contains(placeholderClass())).toBe(true);
  });

  it('asks once after a direct load fails and shows the returned URL', async () => {
    const resolveBlockedImageUrl = vi.fn(async () => 'https://cdn.example.com/final.jpg');
    render(
      <ImageRuntimeProvider {...runtime} resolveBlockedImageUrl={resolveBlockedImageUrl}>
        <ImageNonReact alt="Artwork" candidates={['https://cdn.example.com/start.jpg']} />
      </ImageRuntimeProvider>
    );

    fireEvent.error(screen.getByAltText('Artwork'));

    await waitFor(() => {
      expect(screen.getByAltText('Artwork').getAttribute('src')).toBe(
        'https://cdn.example.com/final.jpg'
      );
    });
    fireEvent.error(screen.getByAltText('Artwork'));
    expect(resolveBlockedImageUrl).toHaveBeenCalledTimes(1);
  });

  it('does not resolve a proxied image', () => {
    const resolveBlockedImageUrl = vi.fn(async () => 'https://cdn.example.com/final.jpg');
    render(
      <ImageRuntimeProvider
        {...runtime}
        imageProxyEnabled
        resolveBlockedImageUrl={resolveBlockedImageUrl}
      >
        <ImageNonReact alt="Artwork" candidates={['https://cdn.example.com/start.jpg']} />
      </ImageRuntimeProvider>
    );

    fireEvent.error(screen.getByAltText('Artwork'));

    expect(resolveBlockedImageUrl).not.toHaveBeenCalled();
    expect(screen.getByAltText('Artwork').getAttribute('src')).toBe('/placeholder.png');
  });

  it('shows the placeholder when a direct failure has no replacement URL', async () => {
    render(
      <ImageRuntimeProvider {...runtime} resolveBlockedImageUrl={async () => null}>
        <ImageNonReact alt="Artwork" candidates={['https://cdn.example.com/start.jpg']} />
      </ImageRuntimeProvider>
    );

    fireEvent.error(screen.getByAltText('Artwork'));

    await waitFor(() => {
      expect(screen.getByAltText('Artwork').getAttribute('src')).toBe('/placeholder.png');
    });
  });
});
