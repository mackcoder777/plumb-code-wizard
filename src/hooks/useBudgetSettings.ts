import { useEffect, useRef, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// All settings keys we persist
const SETTINGS_KEYS = [
  'zip',
  'taxrate',
  'foreman_enabled',
  'foreman_pct',
  'fab_configs',
  'tax_overrides',
  'lrcn_enabled',
  'fab_lrcn_enabled',
  'bid_rates',
  'budget_rate',
  'fab_code_map',
  'fab_rates',
  'custom_fab_codes',
  'consolidation_thresholds',
  'fab_excluded_sections',
] as const;

export type SettingsKey = typeof SETTINGS_KEYS[number];

type SettingsMap = Partial<Record<SettingsKey, unknown>>;

/**
 * Hook that fetches all budget settings for a project from the DB.
 * Returns a map of settings and a debounced save function.
 */
export function useBudgetSettings(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const queryKey = ['budget-settings', projectId];

  const { data: dbSettings, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<SettingsMap> => {
      if (!projectId || projectId === 'default') return {};
      const { data, error } = await supabase
        .from('project_budget_settings')
        .select('settings_key, settings_value')
        .eq('project_id', projectId);
      if (error) {
        console.error('Failed to load budget settings:', error);
        return {};
      }
      const map: SettingsMap = {};
      for (const row of data ?? []) {
        map[row.settings_key as SettingsKey] = row.settings_value;
      }
      return map;
    },
    enabled: !!projectId && projectId !== 'default',
    staleTime: 30_000,
  });

  /**
   * Debounced upsert of a single settings key.
   * localStorage is written immediately (sync cache).
   * DB write is debounced 500ms.
   */
  const saveSetting = useCallback(
    (key: SettingsKey, value: unknown) => {
      if (!projectId || projectId === 'default') return;
      // Fix A: skip null/undefined writes — settings_value is NOT NULL jsonb
      if (value === null || value === undefined) return;

      // Immediate localStorage cache
      localStorage.setItem(`budget_${key}_${projectId}`, typeof value === 'string' ? value : JSON.stringify(value));

      // Optimistic cache update
      queryClient.setQueryData<SettingsMap>(queryKey, (prev) => ({
        ...prev,
        [key]: value,
      }));

      // Debounced DB write
      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
      }
      debounceTimers.current[key] = setTimeout(async () => {
        try {
          const { error } = await supabase
            .from('project_budget_settings')
            .upsert(
              {
                project_id: projectId,
                settings_key: key,
                settings_value: value as any,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'project_id,settings_key' }
            );
          if (error) {
            console.error(`Failed to save setting ${key}:`, error);
            toast({ title: 'Failed to save setting', description: key, variant: 'destructive' });
            // Revert optimistic update
            queryClient.invalidateQueries({ queryKey });
          }
        } catch (err) {
          console.error(`Failed to save setting ${key}:`, err);
          toast({ title: 'Failed to save setting', description: key, variant: 'destructive' });
          queryClient.invalidateQueries({ queryKey });
        }
      }, 500);
    },
    [projectId, queryClient, queryKey]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  /**
   * Get a setting value. Priority: DB data > localStorage fallback.
   * Used during initial load to migrate existing localStorage data.
   */
  const getSetting = useCallback(
    <T>(key: SettingsKey, fallback: T): T => {
      // DB data takes priority
      if (dbSettings && key in dbSettings) {
        return dbSettings[key] as T;
      }
      // localStorage fallback (migration path)
      if (projectId && projectId !== 'default') {
        const lsKey = `budget_${key}_${projectId}`;
        const stored = localStorage.getItem(lsKey);
        if (stored !== null) {
          try {
            return JSON.parse(stored) as T;
          } catch {
            return stored as unknown as T;
          }
        }
      }
      return fallback;
    },
    [dbSettings, projectId]
  );

  return {
    dbSettings: dbSettings ?? {},
    isLoading,
    saveSetting,
    getSetting,
  };
}
