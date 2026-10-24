import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const FIT_VIEWPORT = { width: 1280, height: 1400 } as const;
const OVERFLOW_VIEWPORT = { width: 1280, height: 240 } as const;
const ALIGN_TOLERANCE_PX = 2;

type FrameMetrics = {
  horizontalDelta: number;
  verticalDelta: number;
  scrollTop: number;
  overflows: boolean;
  contentStartsAtTop: boolean;
};

async function readFrameMetrics(frame: Locator): Promise<FrameMetrics> {
  return frame.evaluate((el, tolerance) => {
    const heading = el.querySelector('h1');
    const panel = heading?.parentElement ?? null;
    if (panel === null) {
      throw new Error('Centered frame is missing its content panel');
    }
    const frameRect = el.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const style = getComputedStyle(el);
    const paddingTop = Number.parseFloat(style.paddingTop);
    const paddingRight = Number.parseFloat(style.paddingRight);
    const paddingBottom = Number.parseFloat(style.paddingBottom);
    const paddingLeft = Number.parseFloat(style.paddingLeft);
    const boxLeft = frameRect.left + paddingLeft;
    const boxWidth = el.clientWidth - paddingLeft - paddingRight;
    const boxTop = frameRect.top + paddingTop;
    const boxHeight = el.clientHeight - paddingTop - paddingBottom;
    const panelCenterX = panelRect.left + panelRect.width / 2;
    const panelCenterY = panelRect.top + panelRect.height / 2;

    return {
      horizontalDelta: Math.abs(panelCenterX - (boxLeft + boxWidth / 2)),
      verticalDelta: Math.abs(panelCenterY - (boxTop + boxHeight / 2)),
      scrollTop: el.scrollTop,
      overflows: el.scrollHeight > el.clientHeight + 1,
      contentStartsAtTop: Math.abs(panelRect.top - (frameRect.top + paddingTop)) < tolerance,
    };
  }, ALIGN_TOLERANCE_PX);
}

/**
 * The frame centers its panel while the panel fits. A short viewport makes the same
 * panel scroll, with the scroll position starting at the top of the panel.
 */
export async function expectCenteredOrScrollsFromTop(page: Page, frame: Locator): Promise<void> {
  const previous = page.viewportSize();
  try {
    await page.setViewportSize(FIT_VIEWPORT);
    const fitted = await readFrameMetrics(frame);
    expect(fitted.overflows).toBe(false);
    expect(fitted.scrollTop).toBe(0);
    expect(fitted.horizontalDelta).toBeLessThan(ALIGN_TOLERANCE_PX);
    expect(fitted.verticalDelta).toBeLessThan(ALIGN_TOLERANCE_PX);

    await page.setViewportSize(OVERFLOW_VIEWPORT);
    const overflowing = await readFrameMetrics(frame);
    expect(overflowing.overflows).toBe(true);
    expect(overflowing.scrollTop).toBe(0);
    expect(overflowing.contentStartsAtTop).toBe(true);
    expect(overflowing.horizontalDelta).toBeLessThan(ALIGN_TOLERANCE_PX);

    await frame.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(frame.getByRole('button').last()).toBeInViewport();
    const headingBox = await frame.getByRole('heading', { level: 1 }).boundingBox();
    const frameBox = await frame.boundingBox();
    expect(headingBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    if (headingBox !== null && frameBox !== null) {
      expect(headingBox.y).toBeLessThan(frameBox.y);
    }
  } finally {
    if (previous !== null) {
      await page.setViewportSize(previous);
    }
    await frame.evaluate((el) => {
      el.scrollTop = 0;
    });
  }
}
