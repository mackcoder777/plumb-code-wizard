import { useState, useEffect } from 'react';

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  sortable: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'drawing', label: 'Drawing', visible: true, sortable: true },
  { key: 'system', label: 'System', visible: true, sortable: true },
  { key: 'floor', label: 'Floor', visible: true, sortable: true },
  { key: 'zone', label: 'Zone', visible: true, sortable: true },
  { key: 'symbol', label: 'Symbol', visible: false, sortable: true },
  { key: 'estimator', label: 'Estimator', visible: false, sortable: true },
  { key: 'materialSpec', label: 'Material Spec', visible: false, sortable: true },
  { key: 'itemType', label: 'Item Type', visible: false, sortable: true },
  { key: 'reportCat', label: 'Report Cat', visible: false, sortable: true },
  { key: 'trade', label: 'Trade', visible: false, sortable: true },
  { key: 'materialDesc', label: 'Material', visible: true, sortable: true },
  { key: 'itemName', label: 'Item', visible: true, sortable: true },
  { key: 'size', label: 'Size', visible: true, sortable: true },
  { key: 'quantity', label: 'Qty', visible: true, sortable: true },
  { key: 'listPrice', label: 'List Price', visible: false, sortable: true },
  { key: 'materialDollars', label: 'Material $', visible: true, sortable: true },
  { key: 'weight', label: 'Weight', visible: false, sortable: true },
  { key: 'hours', label: 'Hours', visible: true, sortable: true },
  { key: 'laborDollars', label: 'Labor $', visible: false, sortable: true },
  { key: 'materialCostCode', label: 'Material Code', visible: true, sortable: true },
  { key: 'costCode', label: 'Labor Code', visible: true, sortable: true },
];

const STORAGE_KEY = 'estimate-column-config';

export const useColumnConfig = () => {
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ColumnConfig[];
        // Merge with defaults to handle new columns added later
        return DEFAULT_COLUMNS.map(defaultCol => {
          const storedCol = parsed.find(c => c.key === defaultCol.key);
          return storedCol ? { ...defaultCol, visible: storedCol.visible } : defaultCol;
        });
      }
    } catch (e) {
      console.error('Failed to parse column config from localStorage:', e);
    }
    return DEFAULT_COLUMNS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  const toggleColumn = (key: string) => {
    setColumns(prev => prev.map(col => 
      col.key === key ? { ...col, visible: !col.visible } : col
    ));
  };

  const resetToDefaults = () => {
    setColumns(DEFAULT_COLUMNS);
  };

  // Auto-hide columns that have no data
  const autoHideEmptyColumns = (data: any[]) => {
    if (!data || data.length === 0) return;

    // Keys that should always remain visible regardless of data
    const alwaysVisibleKeys = ['costCode', 'materialCostCode', 'materialDesc', 'itemName', 'quantity', 'materialDollars', 'hours'];
    
    setColumns(prev => prev.map(col => {
      // Skip columns that should always be visible
      if (alwaysVisibleKeys.includes(col.key)) {
        return col;
      }
      
      // Check if any row has non-empty data for this column
      const hasData = data.some(item => {
        const val = item[col.key];
        if (val === undefined || val === null) return false;
        if (typeof val === 'string') return val.trim() !== '';
        if (typeof val === 'number') return val !== 0;
        return true;
      });
      
      // Auto-hide if no data, show if has data
      return { ...col, visible: hasData };
    }));
  };

  const visibleColumns = columns.filter(col => col.visible);

  return {
    columns,
    visibleColumns,
    toggleColumn,
    resetToDefaults,
    autoHideEmptyColumns,
  };
};
