import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChipRowWithActions } from './ChipRowWithActions';

afterEach(() => {
  cleanup();
});

describe('ChipRowWithActions', () => {
  it('puts the actions ahead of the chips in the document', () => {
    render(
      <ChipRowWithActions actions={<button type="button">Create</button>} actionsTestId="actions">
        <div data-testid="chips">Chips</div>
      </ChipRowWithActions>
    );

    const actions = screen.getByTestId('actions');
    const chips = screen.getByTestId('chips');
    expect(actions.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
  });
});
