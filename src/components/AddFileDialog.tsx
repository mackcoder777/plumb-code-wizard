import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EstimateItem } from '@/types/estimate';

interface AddFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: {
    id: string;
    name: string;
    totalItems: number;
    sourceFiles?: string[];
  };
  onAppendData: (items: EstimateItem[], fileName: string) => Promise<void>;
  onReplaceData: (items: EstimateItem[], fileName: string) => Promise<void>;
  // Optional preloaded items from Upload tab
  preloadedItems?: any[] | null;
  preloadedFileName?: string;
}

const AddFileDialog: React.FC<AddFileDialogProps> = ({
  isOpen,
  onClose,
  currentProject,
  onAppendData,
  onReplaceData,
  preloadedItems = null,
  preloadedFileName = ''
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<EstimateItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'append' | 'replace' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Handle preloaded items from Upload tab
  React.useEffect(() => {
    if (preloadedItems && preloadedItems.length > 0) {
      // Transform preloaded items to EstimateItem format if needed
      const transformedItems: EstimateItem[] = preloadedItems.map((item, index) => ({
        id: item.id || `preloaded-${index}`,
        drawing: item.drawing || '',
        system: item.system || '',
        floor: item.floor || '',
        zone: item.zone || '',
        materialSpec: item.materialSpec || '',
        itemType: item.itemType || '',
        trade: item.trade || '',
        materialDesc: item.materialDesc || '',
        itemName: item.itemName || '',
        size: String(item.size || ''),
        quantity: item.quantity || 0,
        listPrice: item.listPrice || 0,
        materialDollars: item.materialDollars || 0,
        hours: item.hours || 0,
        laborDollars: item.laborDollars || 0,
        symbol: item.symbol || '',
        estimator: item.estimator || '',
        reportCat: item.reportCat || '',
        weight: item.weight || 0,
        costCode: item.costCode || '',
        materialCostCode: item.materialCostCode || '',
        suggestedCodes: item.suggestedCodes || [],
        sourceFile: preloadedFileName || item.sourceFile || ''
      }));
      
      setParsedItems(transformedItems);
      setShowConfirmation(true);
    }
  }, [preloadedItems, preloadedFileName]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      const data = await file.arrayBuffer();
      setProcessingProgress(20);

      const workbook = XLSX.read(data);
      setProcessingProgress(40);

      // Find Raw Data sheet
      let sheetName = workbook.SheetNames.find(n => 
        n.toLowerCase().includes('raw')
      ) || workbook.SheetNames[0];

      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      setProcessingProgress(60);

      // Find header row
      let headerRow = 0;
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i];
        if (row?.some((cell: any) => 
          String(cell).toLowerCase() === 'system' ||
          String(cell).toLowerCase() === 'drawing'
        )) {
          headerRow = i;
          break;
        }
      }

      const headers = rawData[headerRow]?.map((h: any) => 
        String(h || '').toLowerCase()
      ) || [];

      // Map columns
      const colMap = {
        drawing: headers.findIndex(h => h.includes('drawing')),
        system: headers.findIndex(h => h === 'system'),
        floor: headers.findIndex(h => h.includes('floor')),
        zone: headers.findIndex(h => h.includes('zone')),
        materialSpec: headers.findIndex(h => h.includes('material spec')),
        itemType: headers.findIndex(h => h.includes('item type')),
        trade: headers.findIndex(h => h.includes('trade')),
        materialDesc: headers.findIndex(h => h.includes('material desc')),
        itemName: headers.findIndex(h => h.includes('item name')),
        size: headers.findIndex(h => h === 'size'),
        quantity: headers.findIndex(h => h.includes('quantity')),
        listPrice: headers.findIndex(h => h.includes('list price')),
        materialDollars: headers.findIndex(h => h.includes('material dollar')),
        // CRITICAL: Use "Field Hours" (Column AA - Total Hours) NOT "Hours" (Column U - Unit Hours)
        fieldHours: headers.findIndex(h => h.includes('field hour') || h === 'field hours'),
        unitHours: headers.findIndex(h => h === 'hours'),
        laborDollars: headers.findIndex(h => h.includes('labor dollar')),
        symbol: headers.findIndex(h => h.includes('symbol')),
        estimator: headers.findIndex(h => h.includes('estimator')),
        reportCat: headers.findIndex(h => h.includes('report') || h.includes('cat')),
        weight: headers.findIndex(h => h.includes('weight')),
      };

      setProcessingProgress(80);

      // Parse items
      const items: EstimateItem[] = [];
      for (let i = headerRow + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length < 5) continue;

        const system = row[colMap.system];
        const drawing = row[colMap.drawing];
        const materialDesc = row[colMap.materialDesc];
        const itemName = row[colMap.itemName];

        // Skip summary rows (rows with no key identifiers)
        if (!system && !drawing && !materialDesc && !itemName) continue;

        items.push({
          id: `new-${items.length}`,
          drawing: row[colMap.drawing] || '',
          system: system || '',
          floor: row[colMap.floor] || '',
          zone: row[colMap.zone] || '',
          materialSpec: row[colMap.materialSpec] || '',
          itemType: row[colMap.itemType] || '',
          trade: row[colMap.trade] || '',
          materialDesc: row[colMap.materialDesc] || '',
          itemName: row[colMap.itemName] || '',
          size: String(row[colMap.size] || ''),
          quantity: parseFloat(row[colMap.quantity]) || 0,
          listPrice: parseFloat(row[colMap.listPrice]) || 0,
          materialDollars: parseFloat(row[colMap.materialDollars]) || 0,
          hours: colMap.fieldHours !== -1 
            ? (parseFloat(row[colMap.fieldHours]) || 0)
            : (colMap.unitHours !== -1 
                ? (parseFloat(row[colMap.unitHours]) || 0) * (parseFloat(row[colMap.quantity]) || 1)
                : 0),
          laborDollars: parseFloat(row[colMap.laborDollars]) || 0,
          symbol: row[colMap.symbol] || '',
          estimator: row[colMap.estimator] || '',
          reportCat: row[colMap.reportCat] || '',
          weight: parseFloat(row[colMap.weight]) || 0,
          costCode: '',
          materialCostCode: '',
          suggestedCodes: [],
          sourceFile: file.name
        });
      }

      setParsedItems(items);
      setProcessingProgress(100);
      setShowConfirmation(true);

    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Error reading file. Please check the format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    // Get file name from either selectedFile OR preloadedFileName
    const fileNameToUse = selectedFile?.name || preloadedFileName || 'Unknown Source';

    if (!selectedAction) return;
    if (!parsedItems.length) {
      console.error('No items to save');
      return;
    }

    setIsProcessing(true);
    try {
      if (selectedAction === 'append') {
        await onAppendData(parsedItems, fileNameToUse);
      } else {
        await onReplaceData(parsedItems, fileNameToUse);
      }
      handleClose();
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Error saving data. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setParsedItems([]);
    setShowConfirmation(false);
    setSelectedAction(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  // Get unique systems from new data
  const newSystems = [...new Set(parsedItems.map(i => i.system).filter(Boolean))];
  const newHours = parsedItems.reduce((sum, i) => sum + (i.hours || 0), 0);
  const newMaterial = parsedItems.reduce((sum, i) => sum + (i.materialDollars || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {showConfirmation ? 'Confirm File Action' : 'Add File to Project'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Project: {currentProject.name}
          </p>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] space-y-4">
          {!showConfirmation ? (
            <>
              {/* Current Project Stats */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 dark:border-blue-800">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Current Project Data</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600 dark:text-blue-400">Total Items:</span>
                    <span className="ml-2 font-mono font-bold">
                      {currentProject.totalItems.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600 dark:text-blue-400">Source Files:</span>
                    <span className="ml-2 font-mono">
                      {currentProject.sourceFiles?.length || 1}
                    </span>
                  </div>
                </div>
                {currentProject.sourceFiles && currentProject.sourceFiles.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-blue-600 dark:text-blue-400">Files:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {currentProject.sourceFiles.map((f, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* File Upload Zone */}
              <div 
                className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xls,.xlsx,.xlsm"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {isProcessing ? (
                  <div className="space-y-4">
                    <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                    <p className="text-muted-foreground">Processing file...</p>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${processingProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-5xl mb-4">📁</div>
                    <p className="text-lg font-medium">
                      Click to select Excel file
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      .xls, .xlsx, or .xlsm with "Raw Data" sheet
                    </p>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* New File Summary */}
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-xl border border-green-200 dark:border-green-800">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
                  <span>✅</span> New File Parsed
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300 mb-3 font-medium">
                  {selectedFile?.name || preloadedFileName || 'Uploaded file'}
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-green-600 dark:text-green-400 block">Items</span>
                    <span className="font-mono font-bold text-lg">
                      {parsedItems.length.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600 dark:text-green-400 block">Hours</span>
                    <span className="font-mono font-bold text-lg">
                      {newHours.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-green-600 dark:text-green-400 block">Material $</span>
                    <span className="font-mono font-bold text-lg">
                      ${newMaterial.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-xs text-green-600 dark:text-green-400 block mb-1">
                    Systems found ({newSystems.length}):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {newSystems.slice(0, 10).map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs">
                        {s}
                      </span>
                    ))}
                    {newSystems.length > 10 && (
                      <span className="px-2 py-0.5 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 rounded text-xs">
                        +{newSystems.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Selection */}
              <div className="space-y-3">
                <h3 className="font-semibold">Choose Action:</h3>

                {/* Append Option */}
                <label 
                  className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedAction === 'append' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="action"
                    value="append"
                    checked={selectedAction === 'append'}
                    onChange={() => setSelectedAction('append')}
                    className="sr-only"
                  />
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      selectedAction === 'append' ? 'border-blue-500' : 'border-muted-foreground/50'
                    }`}>
                      {selectedAction === 'append' && (
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-2">
                        <span className="text-xl">➕</span> Add to Project
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                          RECOMMENDED
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Keep existing {currentProject.totalItems.toLocaleString()} items and add {parsedItems.length.toLocaleString()} new items.
                        <br />
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          ✓ Preserves all existing cost code mappings
                        </span>
                      </p>
                      <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900 rounded text-xs text-blue-800 dark:text-blue-200">
                        Result: {(currentProject.totalItems + parsedItems.length).toLocaleString()} total items
                      </div>
                    </div>
                  </div>
                </label>

                {/* Replace Option */}
                <label 
                  className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedAction === 'replace' 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' 
                      : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="action"
                    value="replace"
                    checked={selectedAction === 'replace'}
                    onChange={() => setSelectedAction('replace')}
                    className="sr-only"
                  />
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      selectedAction === 'replace' ? 'border-orange-500' : 'border-muted-foreground/50'
                    }`}>
                      {selectedAction === 'replace' && (
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-2">
                        <span className="text-xl">🔄</span> Replace All Data
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Delete existing {currentProject.totalItems.toLocaleString()} items and replace with {parsedItems.length.toLocaleString()} new items.
                        <br />
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          ⚠️ Existing cost code mappings will be lost
                        </span>
                      </p>
                      <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-900 rounded text-xs text-orange-800 dark:text-orange-200">
                        Result: {parsedItems.length.toLocaleString()} total items (replacing {currentProject.totalItems.toLocaleString()})
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          
          {showConfirmation && (
            <Button
              onClick={handleConfirm}
              disabled={!selectedAction || isProcessing}
              variant={selectedAction === 'replace' ? 'destructive' : 'default'}
            >
              {isProcessing ? (
                <>Processing...</>
              ) : selectedAction === 'append' ? (
                <>Add {parsedItems.length.toLocaleString()} Items</>
              ) : selectedAction === 'replace' ? (
                <>Replace All Data</>
              ) : (
                <>Select an action</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFileDialog;
