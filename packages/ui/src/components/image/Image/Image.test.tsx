import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: function MockNextImage(props: {
    alt: string;
    className?: string;
    decoding?: string;
    loading?: string;
    onError?: () => void;
    priority?: boolean;
    src: string;
    unoptimized?: boolean;
  }) {
    return (
      <img
        alt={props.alt}
        className={props.className}
        data-decoding={props.decoding}
        data-loading={props.loading}
        data-priority={props.priority === true ? 'true' : 'false'}
        data-testid="next-image"
        data-unoptimized={props.unoptimized === true ? 'true' : 'false'}
        onError={props.onError}
        src={props.src}
      />
    );
  },
}));

import { ImageRuntimeProvider } from '../ImageRuntime/ImageRuntime';
import { Image } from './Image';

import styles from './Image.module.scss';

const defaultRuntime = {
  imageProxyEnabled: true,
  nextImageOptimizationEnabled: false,
  listGridSlotSize: 600,
  placeholderSrc: '/placeholder.png',
  proxyPathPrefix: '/api/proxy?url=',
} as const;

function moduleClass(className: string | undefined): string {
  if (className === undefined) {
    throw new Error('Expected the CSS module to define this class');
  }
  return className;
}

function renderWithRuntime(ui: ReactElement) {
  return render(<ImageRuntimeProvider {...defaultRuntime}>{ui}</ImageRuntimeProvider>);
}

afterEach(() => {
  cleanup();
});

describe('Image', () => {
  it('renders placeholder artwork when src is empty', () => {
    renderWithRuntime(<Image alt="Episode" height={64} src={null} width={64} />);

    expect(screen.getByTestId('next-image').getAttribute('src')).toBe('/placeholder.png');
  });

  it('prefixes remote URL when image proxy is enabled', () => {
    renderWithRuntime(
      <Image alt="Episode" height={64} src="https://cdn.example.com/a.jpg" width={64} />
    );

    expect(screen.getByTestId('next-image').getAttribute('src')).toBe(
      `/api/proxy?url=${encodeURIComponent('https://cdn.example.com/a.jpg')}`
    );
  });

  it('uses raw URL when skipProxy is true', () => {
    renderWithRuntime(
      <Image alt="Episode" height={64} skipProxy src="https://cdn.example.com/a.jpg" width={64} />
    );

    expect(screen.getByTestId('next-image').getAttribute('src')).toBe(
      'https://cdn.example.com/a.jpg'
    );
  });

  it('uses raw URL when proxy is disabled', () => {
    render(
      <ImageRuntimeProvider {...defaultRuntime} imageProxyEnabled={false}>
        <Image alt="Episode" height={64} src="https://cdn.example.com/a.jpg" width={64} />
      </ImageRuntimeProvider>
    );

    expect(screen.getByTestId('next-image').getAttribute('src')).toBe(
      'https://cdn.example.com/a.jpg'
    );
  });

  it('loads remote artwork lazily and decodes it asynchronously when priority is not set', () => {
    renderWithRuntime(
      <Image alt="Episode" height={64} src="https://cdn.example.com/a.gif" width={64} />
    );

    const image = screen.getByTestId('next-image');
    expect(image.getAttribute('data-loading')).toBe('lazy');
    expect(image.getAttribute('data-decoding')).toBe('async');
  });

  it('does not ask for lazy loading when priority is set', () => {
    renderWithRuntime(
      <Image alt="Episode" height={64} priority src="https://cdn.example.com/a.gif" width={64} />
    );

    const image = screen.getByTestId('next-image');
    expect(image.getAttribute('data-priority')).toBe('true');
    expect(image.getAttribute('data-loading')).toBeNull();
    expect(image.getAttribute('data-decoding')).toBe('async');
  });

  it('sets unoptimized when Next image optimization is disabled in runtime', () => {
    renderWithRuntime(
      <Image alt="Episode" height={64} src="https://cdn.example.com/a.jpg" width={64} />
    );

    expect(screen.getByTestId('next-image').getAttribute('data-unoptimized')).toBe('true');
  });

  it('clears unoptimized when Next image optimization is enabled in runtime', () => {
    render(
      <ImageRuntimeProvider {...defaultRuntime} nextImageOptimizationEnabled>
        <Image alt="Episode" height={64} src="https://cdn.example.com/a.jpg" width={64} />
      </ImageRuntimeProvider>
    );

    expect(screen.getByTestId('next-image').getAttribute('data-unoptimized')).toBe('false');
  });

  it('keeps the caller class on the outer placeholder box and centers the image in an inner box', () => {
    const { container } = renderWithRuntime(
      <Image alt="Episode" className="caller-image" height={64} src={null} width={64} />
    );

    const outer = container.firstElementChild;
    const placeholderImage = screen.getByTestId('next-image');
    const inner = placeholderImage.parentElement;

    expect(outer?.classList.contains('caller-image')).toBe(true);
    expect(outer?.classList.contains(moduleClass(styles.placeholderOuter))).toBe(true);
    expect(inner).not.toBe(outer);
    expect(inner?.parentElement).toBe(outer);
    expect(inner?.classList.contains(moduleClass(styles.placeholderInner))).toBe(true);
    expect(inner?.classList.contains('caller-image')).toBe(false);
  });

  it('fills the parent slot instead of stamping a pixel edge on the empty artwork', () => {
    const { container } = renderWithRuntime(
      <Image alt="Episode" fill height={88} src={null} width={88} />
    );

    const outer = container.firstElementChild as HTMLElement;
    const placeholderImage = screen.getByTestId('next-image');

    expect(outer.style.width).toBe('');
    expect(outer.style.height).toBe('');
    expect(outer.classList.contains(moduleClass(styles.fillFrame))).toBe(true);
    expect(outer.classList.contains(moduleClass(styles.placeholderOuter))).toBe(true);
    expect(placeholderImage.classList.contains(moduleClass(styles.fillImage))).toBe(true);
    expect(placeholderImage.parentElement).toBe(outer);
  });

  it('keeps the fluid slot class on the outer box for a list grid slot', () => {
    const { container } = renderWithRuntime(
      <Image alt="Episode" className="caller-image" height={600} src={null} width={600} />
    );

    const outer = container.firstElementChild;

    expect(outer?.classList.contains(moduleClass(styles.placeholderOuterFluid))).toBe(true);
    expect(
      screen.getByTestId('next-image').classList.contains(moduleClass(styles.imagePlaceholderFluid))
    ).toBe(true);
  });

  it('applies unoptimized to placeholder Next image when optimization is disabled', () => {
    renderWithRuntime(<Image alt="Episode" height={64} src={null} width={64} />);

    expect(screen.getByTestId('next-image').getAttribute('data-unoptimized')).toBe('true');
  });

  it('asks once after a direct load fails and shows the returned URL', async () => {
    const resolveBlockedImageUrl = vi.fn(async () => 'https://cdn.example.com/final.jpg');
    render(
      <ImageRuntimeProvider
        {...defaultRuntime}
        imageProxyEnabled={false}
        resolveBlockedImageUrl={resolveBlockedImageUrl}
      >
        <Image alt="Episode" height={64} src="https://cdn.example.com/start.jpg" width={64} />
      </ImageRuntimeProvider>
    );

    fireEvent.error(screen.getByAltText('Episode'));

    await waitFor(() => {
      expect(screen.getByAltText('Episode').getAttribute('src')).toBe(
        'https://cdn.example.com/final.jpg'
      );
    });
    fireEvent.error(screen.getByAltText('Episode'));
    expect(resolveBlockedImageUrl).toHaveBeenCalledTimes(1);
  });

  it('does not resolve a proxied or optimized image', () => {
    const resolveBlockedImageUrl = vi.fn(async () => 'https://cdn.example.com/final.jpg');
    const { unmount } = render(
      <ImageRuntimeProvider {...defaultRuntime} resolveBlockedImageUrl={resolveBlockedImageUrl}>
        <Image alt="Episode" height={64} src="https://cdn.example.com/start.jpg" width={64} />
      </ImageRuntimeProvider>
    );
    fireEvent.error(screen.getByAltText('Episode'));
    unmount();

    render(
      <ImageRuntimeProvider
        {...defaultRuntime}
        imageProxyEnabled={false}
        nextImageOptimizationEnabled
        resolveBlockedImageUrl={resolveBlockedImageUrl}
      >
        <Image alt="Episode" height={64} src="https://cdn.example.com/start.jpg" width={64} />
      </ImageRuntimeProvider>
    );
    fireEvent.error(screen.getByAltText('Episode'));

    expect(resolveBlockedImageUrl).not.toHaveBeenCalled();
  });

  it('shows the placeholder when a direct failure has no replacement URL', async () => {
    render(
      <ImageRuntimeProvider
        {...defaultRuntime}
        imageProxyEnabled={false}
        resolveBlockedImageUrl={async () => null}
      >
        <Image alt="Episode" height={64} src="https://cdn.example.com/start.jpg" width={64} />
      </ImageRuntimeProvider>
    );

    fireEvent.error(screen.getByAltText('Episode'));

    await waitFor(() => {
      expect(screen.getByAltText('Episode').getAttribute('src')).toBe('/placeholder.png');
    });
  });
});
