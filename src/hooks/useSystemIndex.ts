import { useState, useEffect, useRef, useCallback } from 'react';
import { EstimateItem } from '@/types/estimate';

export interface SystemIndexEntry {
  system: string;
  itemCount: number;
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

export function useSystemIndex(data: EstimateItem[]): UseSystemIndexResult {
  const [systemIndex, setSystemIndex] = useState<SystemIndexEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTimeMs, setProcessingTimeMs] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const dataRef = useRef<EstimateItem[]>(data);
  
  // Keep data ref updated for getPreviewItems
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
      const startTime = performance.now();
      const systemMap = new Map<string, {
        count: number;
        previewItems: typeof data;
        itemTypeCounts: Map<string, number>;
      }>();

      for (const item of data) {
        const systemKey = item.system || 'Unknown';
        if (!systemMap.has(systemKey)) {
          systemMap.set(systemKey, {
            count: 0,
            previewItems: [],
            itemTypeCounts: new Map(),
          });
        }
        const entry = systemMap.get(systemKey)!;
        entry.count++;
        if (entry.previewItems.length < 5) {
          entry.previewItems.push(item);
        }
        const itemType = item.itemType || 'Unknown';
        entry.itemTypeCounts.set(itemType, (entry.itemTypeCounts.get(itemType) || 0) + 1);
      }

      const result: SystemIndexEntry[] = Array.from(systemMap.entries())
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

      setSystemIndex(result);
      setProcessingTimeMs(performance.now() - startTime);
      setIsProcessing(false);
      return;
    }

    // For large datasets, use Web Worker
    try {
      const worker = new Worker(
        new URL('../workers/systemMapper.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      worker.onmessage = (e) => {
        if (e.data.type === 'INDEX_COMPLETE') {
          setSystemIndex(e.data.systemIndex);
          setProcessingTimeMs(e.data.processingTimeMs);
          setIsProcessing(false);
          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = (error) => {
        console.error('System index worker error:', error);
        // Fallback to sync processing on worker error
        setIsProcessing(false);
      };

      // Send minimal data to worker
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
      setIsProcessing(false);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [data]);

  // Get preview items for a system - uses the full data array
  // limit=0 means return all items for that system
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

  return {
    systemIndex,
    isProcessing,
    processingTimeMs,
    getPreviewItems,
  };
}
