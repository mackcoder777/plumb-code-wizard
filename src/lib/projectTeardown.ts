/**
 * Client-side teardown helpers for project deletion.
 *
 * Server-side deletion is already clean: every FK to estimate_projects is
 * ON DELETE CASCADE, so child rows vanish with the project row. The client
 * is where references leak — per-project query caches, the budget_*
 * localStorage mirror, and the lastSelectedProjectId restore pointer can
 * all keep naming a dead project id after the delete.
 */

/**
 * Postgres foreign-key violation. The project-scoped settings table's only
 * FK is project_id → estimate_projects, so this code on a settings write
 * means exactly one thing: the write raced a project delete and lost.
 * Persisting a setting for a project that no longer exists is moot, so the
 * caller may treat this as benign rather than surfacing a failure.
 */
export function isDeletedProjectWriteError(
  error: { code?: string } | null | undefined
): boolean {
  return error?.code === '23503';
}

/**
 * The localStorage keys mirroring a project's budget settings, written by
 * useBudgetSettings.saveSetting as `budget_<settingsKey>_<projectId>`.
 * Returns the subset of allKeys to remove when that project is deleted.
 */
export function projectScopedStorageKeys(
  allKeys: readonly string[],
  projectId: string
): string[] {
  if (!projectId) return [];
  const suffix = `_${projectId}`;
  return allKeys.filter((k) => k.startsWith('budget_') && k.endsWith(suffix));
}
