export function correspondingSourceUrl(
  repository?: string,
  revision?: string,
): string | undefined {
  const normalizedRepository = repository?.replace(/\/$/, '')
  if (!normalizedRepository) return undefined
  return revision
    ? `${normalizedRepository}/tree/${encodeURIComponent(revision)}`
    : normalizedRepository
}
