'use client';

import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { useTranslations } from 'next-intl';
import { FaGripLines } from 'react-icons/fa6';

type ListReorderHandleProps = {
  className?: string;
  /**
   * Drag handle for this grip. It stays on the grip so a press on the row's play control
   * still clicks. A handle on the whole row cancels that click.
   */
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
};

export function ListReorderHandle({ className, dragHandleProps }: ListReorderHandleProps) {
  const tFeatures = useTranslations('features');

  return (
    <div
      className={className}
      {...(dragHandleProps ?? {})}
      aria-label={dragHandleProps ? tFeatures('playlist.reorder') : undefined}
    >
      <FaGripLines aria-hidden />
    </div>
  );
}
