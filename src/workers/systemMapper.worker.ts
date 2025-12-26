// Web Worker for building system index from large datasets
// Runs off main thread to prevent UI blocking

interface EstimateItemMinimal {
  id: string;
  system?: string | null;
  itemType?: string | null;
  drawing?: string | null;
  materialDesc?: string | null;
  quantity?: number | null;
  hours?: number | null;
}

interface SystemIndexEntry {
  system: string;
  itemCount: number;
  previewItems: EstimateItemMinimal[];
  itemTypeCounts: Record<string, number>;
}

interface WorkerMessage {
  type: 'BUILD_INDEX';
  data: EstimateItemMinimal[];
}

interface WorkerResponse {
  type: 'INDEX_COMPLETE';
  systemIndex: SystemIndexEntry[];
  totalSystems: number;
  processingTimeMs: number;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type === 'BUILD_INDEX') {
    const startTime = performance.now();
    const data = e.data.data;
    
    // Build system map with counts and preview items
    const systemMap = new Map<string, {
      count: number;
      previewItems: EstimateItemMinimal[];
      itemTypeCounts: Map<string, number>;
    }>();
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
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
      
      // Store only first 5 items as preview
      if (entry.previewItems.length < 5) {
        entry.previewItems.push({
          id: item.id,
          system: item.system,
          itemType: item.itemType,
          drawing: item.drawing,
          materialDesc: item.materialDesc,
          quantity: item.quantity,
          hours: item.hours,
        });
      }
      
      // Count item types
      const itemType = item.itemType || 'Unknown';
      entry.itemTypeCounts.set(itemType, (entry.itemTypeCounts.get(itemType) || 0) + 1);
    }
    
    // Convert to array and sort by count
    const systemIndex: SystemIndexEntry[] = Array.from(systemMap.entries())
      .map(([system, entry]) => ({
        system,
        itemCount: entry.count,
        previewItems: entry.previewItems,
        itemTypeCounts: Object.fromEntries(entry.itemTypeCounts),
      }))
      .sort((a, b) => b.itemCount - a.itemCount);
    
    const endTime = performance.now();
    
    const response: WorkerResponse = {
      type: 'INDEX_COMPLETE',
      systemIndex,
      totalSystems: systemIndex.length,
      processingTimeMs: endTime - startTime,
    };
    
    self.postMessage(response);
  }
};
