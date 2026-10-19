export function isRemovedSource(resource: { source_removed_at?: string | null }): boolean {
  return typeof resource.source_removed_at === 'string' && resource.source_removed_at.length > 0;
}
