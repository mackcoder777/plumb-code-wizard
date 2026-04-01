import { useState, useEffect, useRef, useCallback } from 'react';
import { EstimateItem } from '@/types/estimate';

export interface SystemIndexEntry {
  system: string;
  itemCount: number;
  totalHours: number;
  previewItems: Array<{
    id: string;
    system?: string | null;
    itemType?: string | null;
    drawing?: string | null;
    materialDesc?: string | null;
    quantity?: number | null;
    hours?: number | null;
  }>;
  itemTypeCounts: Record<string, number>;
}

interface UseSystemIndexResult {
  systemIndex: SystemIndexEntry[];
  isProcessing: boolean;
  processingTimeMs: number | null;
  getPreviewItems: (system: string) => EstimateItem[];
}

function buildIndexSync(data: EstimateItem[]): { systemIndex: SystemIndexEntry[]; processingTimeMs: number } {
  const startTime = performance.now();
  const systemMap = new Map<string, {
    count: number;
    totalHours: number;
    previewItems: typeof data;
    itemTypeCounts: Map<string, number>;
  }>();

  for (const item of data) {
    const systemKey = item.system || 'Unknown';
    if (!systemMap.has(systemKey)) {
      systemMap.set(systemKey, { count: 0, totalHours: 0, previewItems: [], itemTypeCounts: new Map() });
    }
    const entry = systemMap.get(systemKey)!;
    entry.count++;
    entry.totalHours += item.hours || 0;
    if (entry.previewItems.length < 5) {
      entry.previewItems.push(item);
    }
    const itemType = item.itemType || 'Unknown';
    entry.itemTypeCounts.set(itemType, (entry.itemTypeCounts.get(itemType) || 0) + 1);
  }

  const systemIndex: SystemIndexEntry[] = Array.from(systemMap.entries())
    .map(([system, entry]) => ({
      system,
      itemCount: entry.count,
      previewItems: entry.previewItems.map(item => ({
        id: String(item.id),
        system: item.system ?? undefined,
        itemType: item.itemType ?? undefined,
        drawing: item.drawing ?? undefined,
        materialDesc: item.materialDesc ?? undefined,
        quantity: item.quantity ?? undefined,
        hours: item.hours ?? undefined,
      })),
      itemTypeCounts: Object.fromEntries(entry.itemTypeCounts),
    }))
    .sort((a, b) => b.itemCount - a.itemCount);

  return { systemIndex, processingTimeMs: performance.now() - startTime };
}

export function useSystemIndex(data: EstimateItem[]): UseSystemIndexResult {
  const [systemIndex, setSystemIndex] = useState<SystemIndexEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTimeMs, setProcessingTimeMs] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<EstimateItem[]>(data);
  
  dataRef.current = data;

  useEffect(() => {
    if (data.length === 0) {
      setSystemIndex([]);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);

    // For smaller datasets, process synchronously
    if (data.length < 2000) {
      const result = buildIndexSync(data);
      setSystemIndex(result.systemIndex);
      setProcessingTimeMs(result.processingTimeMs);
      setIsProcessing(false);
      return;
    }

    // For large datasets, try Web Worker with sync fallback
    const runSyncFallback = () => {
      console.warn(`[useSystemIndex] Falling back to sync processing for ${data.length} items`);
      const result = buildIndexSync(data);
      setSystemIndex(result.systemIndex);
      setProcessingTimeMs(result.processingTimeMs);
      setIsProcessing(false);
    };

    try {
      const worker = new Worker(
        new URL('../workers/systemMapper.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      // Configurable timeout: 10s for 10k+ items, 5s otherwise
      const timeoutMs = data.length >= 10000 ? 10000 : 5000;
      timeoutRef.current = setTimeout(() => {
        console.warn(`[useSystemIndex] Worker timed out after ${timeoutMs}ms, falling back to sync`);
        worker.terminate();
        workerRef.current = null;
        runSyncFallback();
      }, timeoutMs);

      worker.onmessage = (e) => {
        if (e.data.type === 'INDEX_COMPLETE') {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setSystemIndex(e.data.systemIndex);
          setProcessingTimeMs(e.data.processingTimeMs);
          setIsProcessing(false);
          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = (error) => {
        console.error('System index worker error:', error);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        worker.terminate();
        workerRef.current = null;
        runSyncFallback();
      };

      const minimalData = data.map(item => ({
        id: item.id,
        system: item.system,
        itemType: item.itemType,
        drawing: item.drawing,
        materialDesc: item.materialDesc,
        quantity: item.quantity,
        hours: item.hours,
      }));

      worker.postMessage({ type: 'BUILD_INDEX', data: minimalData });
    } catch (error) {
      console.error('Failed to create worker:', error);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      runSyncFallback();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [data]);

  const getPreviewItems = useCallback((system: string, limit: number = 5): EstimateItem[] => {
    const items: EstimateItem[] = [];
    for (const item of dataRef.current) {
      if ((item.system || 'Unknown') === system) {
        items.push(item);
        if (limit > 0 && items.length >= limit) break;
      }
    }
    return items;
  }, []);

  return { systemIndex, isProcessing, processingTimeMs, getPreviewItems };
}
