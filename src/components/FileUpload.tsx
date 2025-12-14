import React, { useCallback, useState } from 'react';
import { EstimateItem, CostCodeSuggestion } from '@/types/estimate';
import { COST_CODES_DB, AUTOMATION_RULES } from '@/data/costCodes';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface FileUploadProps {
  onFileUpload: (data: EstimateItem[], file: File) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileUpload, 
  isLoading, 
  setIsLoading 
}) => {
  const [dragOver, setDragOver] = useState(false);

  const getSuggestedCostCodes = useCallback((item: EstimateItem): CostCodeSuggestion[] => {
    const suggestions: CostCodeSuggestion[] = [];
    
    // Check automation rules
    AUTOMATION_RULES.forEach(rule => {
      const fieldValue = (item as any)[rule.field] || '';
      if (rule.pattern.test(fieldValue)) {
        if (rule.codes.material) {
          suggestions.push({
            code: rule.codes.material,
            type: 'material',
            confidence: 0.9,
            reason: rule.description
          });
        }
        if (rule.codes.labor) {
          suggestions.push({
            code: rule.codes.labor,
            type: 'labor',
            confidence: 0.9,
            reason: rule.description
          });
        }
      }
    });
    
    // Check keyword matches in cost codes database
    const allCodes = [...COST_CODES_DB.fieldLabor, ...COST_CODES_DB.material];
    allCodes.forEach(codeEntry => {
      const itemText = `${item.system} ${item.materialDesc} ${item.itemName}`.toLowerCase();
      const matchCount = codeEntry.keywords.filter(keyword => 
        itemText.includes(keyword.toLowerCase())
      ).length;
      
      if (matchCount > 0) {
        const existing = suggestions.find(s => s.code === codeEntry.code);
        if (!existing) {
          suggestions.push({
            code: codeEntry.code,
            type: codeEntry.category === 'L' ? 'labor' : 'material',
            confidence: Math.min(0.6 + (matchCount * 0.2), 1),
            reason: `Matches: ${codeEntry.keywords.filter(k => itemText.includes(k.toLowerCase())).join(', ')}`
          });
        }
      }
    });
    
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }, []);

  // FIXED: Use header-based detection like AddFileDialog.tsx
  const processRawData = useCallback(async (file: File): Promise<EstimateItem[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    
    // Find Raw Data sheet
    let sheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('raw')
    ) || workbook.SheetNames[0];
    
    const sheet = workbook.Sheets[sheetName];
    
    // CRITICAL FIX: Use { header: 1 } to get raw arrays instead of auto-keyed objects
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log('=== FileUpload Parsing Debug ===');
    console.log('Sheet name:', sheetName);
    console.log('Total rows:', rawData.length);
    
    // Find the header row by scanning first 15 rows for key columns
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(15, rawData.length); i++) {
      const row = rawData[i];
      if (row && Array.isArray(row)) {
        const rowLower = row.map(cell => String(cell || '').toLowerCase());
        // Look for rows containing both "system" and "drawing" or "material"
        if (rowLower.some(c => c === 'system') && 
            (rowLower.some(c => c.includes('drawing')) || rowLower.some(c => c.includes('material')))) {
          headerRowIndex = i;
          console.log('Found header row at index:', i);
          break;
        }
      }
    }
    
    // Get headers and normalize to lowercase
    const headers = (rawData[headerRowIndex] || []).map((h: any) => 
      String(h || '').toLowerCase().trim()
    );
    
    console.log('Headers found:', headers.slice(0, 30)); // First 30 headers
    
    // Helper function to find column index by partial match
    const findCol = (...searchTerms: string[]): number => {
      for (const term of searchTerms) {
        const idx = headers.findIndex(h => {
          if (term.startsWith('=')) {
            // Exact match
            return h === term.slice(1);
          }
          return h.includes(term);
        });
        if (idx !== -1) return idx;
      }
      return -1;
    };
    
    // Build column map - CRITICAL: Look for "field hours" NOT "hours"
    const colMap = {
      drawing: findCol('drawing'),
      system: findCol('=system'),
      floor: findCol('floor', 'flr'),
      zone: findCol('zone'),
      symbol: findCol('symbol'),
      estimator: findCol('estimator'),
      materialSpec: findCol('material spec', 'mat spec'),
      itemType: findCol('item type', 'item ty'),
      reportCat: findCol('report cat'),
      trade: findCol('trade', 'trad'),
      materialDesc: findCol('material description', 'material desc'),
      itemName: findCol('item name'),
      size: findCol('=size'),
      quantity: findCol('quantity', 'qty'),
      listPrice: findCol('list price'),
      materialDollars: findCol('material dollar'),
      weight: findCol('=weight'),
      // CRITICAL: Field Hours (Column AA) - Total hours for line item
      fieldHours: findCol('field hour', 'field hours'),
      // Unit Hours (Column U) - Per-item hours (backup only)
      unitHours: findCol('=hours'),
      laborDollars: findCol('labor dollar'),
    };
    
    console.log('Column Map:', colMap);
    console.log('Field Hours column index:', colMap.fieldHours, '-> Header:', headers[colMap.fieldHours]);
    console.log('Unit Hours column index:', colMap.unitHours, '-> Header:', headers[colMap.unitHours]);
    
    // Validate critical columns
    if (colMap.system === -1) {
      console.error('Could not find "System" column in spreadsheet');
    }
    
    if (colMap.fieldHours === -1) {
      console.warn('WARNING: "Field Hours" column not found! Will calculate from Unit Hours × Quantity');
    }
    
    // Parse data rows
    const items: EstimateItem[] = [];
    let totalHours = 0;
    let totalMaterial = 0;
    
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length < 5) continue;
      
      const system = row[colMap.system];
      const drawing = row[colMap.drawing];
      const materialDesc = row[colMap.materialDesc];
      const itemName = row[colMap.itemName];
      
      // Skip empty/summary rows (rows with no key identifiers)
      if (!system && !drawing && !materialDesc && !itemName) continue;
      
      // CRITICAL: Extract hours correctly
      let hours = 0;
      
      // Priority 1: Use Field Hours (Column AA) - this is the total hours for the line
      if (colMap.fieldHours !== -1 && row[colMap.fieldHours] != null) {
        hours = parseFloat(row[colMap.fieldHours]) || 0;
      }
      // Priority 2: Calculate from Unit Hours × Quantity
      else if (colMap.unitHours !== -1 && row[colMap.unitHours] != null) {
        const unitHours = parseFloat(row[colMap.unitHours]) || 0;
        const qty = parseFloat(row[colMap.quantity]) || 1;
        hours = unitHours * qty;
      }
      
      const materialDollars = parseFloat(row[colMap.materialDollars]) || 0;
      totalHours += hours;
      totalMaterial += materialDollars;
      
      const item: EstimateItem = {
        id: i - headerRowIndex - 1,
        drawing: String(row[colMap.drawing] || ''),
        system: String(system || ''),
        floor: String(row[colMap.floor] || ''),
        zone: String(row[colMap.zone] || ''),
        symbol: String(row[colMap.symbol] || ''),
        estimator: String(row[colMap.estimator] || ''),
        materialSpec: String(row[colMap.materialSpec] || ''),
        itemType: String(row[colMap.itemType] || ''),
        reportCat: String(row[colMap.reportCat] || ''),
        trade: String(row[colMap.trade] || ''),
        materialDesc: String(row[colMap.materialDesc] || ''),
        itemName: String(row[colMap.itemName] || ''),
        size: String(row[colMap.size] || ''),
        quantity: parseFloat(row[colMap.quantity]) || 0,
        listPrice: parseFloat(row[colMap.listPrice]) || 0,
        materialDollars: materialDollars,
        weight: parseFloat(row[colMap.weight]) || 0,
        hours: hours,
        laborDollars: parseFloat(row[colMap.laborDollars]) || 0,
        costCode: '',
        materialCostCode: '',
        suggestedCodes: [],
        sourceFile: file.name,
      };
      
      item.suggestedCodes = getSuggestedCostCodes(item);
      items.push(item);
    }
    
    console.log('=== FileUpload Parsing Complete ===');
    console.log('Items parsed:', items.length);
    console.log('Total Field Hours:', totalHours.toFixed(3));
    console.log('Total Material $:', totalMaterial.toFixed(2));
    console.log('Source File:', file.name);
    
    return items;
  }, [getSuggestedCostCodes]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    
    setIsLoading(true);
    
    try {
      const processedData = await processRawData(file);
      onFileUpload(processedData, file);
    } catch (error) {
      console.error('Error processing file:', error);
    } finally {
      setIsLoading(false);
    }
  }, [processRawData, onFileUpload, setIsLoading]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.xlsm'))) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <Card className="border-2 border-dashed transition-all duration-300 hover:shadow-lg">
      <div
        className={`p-12 text-center transition-all duration-300 ${
          dragOver ? 'border-primary bg-primary/5 scale-105' : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <div>
              <h3 className="text-xl font-semibold mb-2">Processing File...</h3>
              <p className="text-muted-foreground">Please wait while we analyze your estimate data</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="p-4 rounded-full bg-primary/10">
              <FileSpreadsheet className="w-16 h-16 text-primary" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-2">Upload Your Project Estimate</h3>
              <p className="text-muted-foreground mb-4">
                Drag & drop your Excel file here or click to browse
              </p>
              <p className="text-sm text-muted-foreground">
                Supports .xlsx, .xlsm, and .xls files
              </p>
            </div>
            
            <Button 
              size="lg" 
              className="shadow-primary hover:shadow-lg transition-all duration-300"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="w-5 h-5 mr-2" />
              Choose File
            </Button>
            
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xlsm,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}
      </div>
    </Card>
  );
};
