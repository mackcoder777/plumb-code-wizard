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

  const processRawData = useCallback((rawData: any[]): EstimateItem[] => {
    return rawData.map((row, index) => {
      const item: EstimateItem = {
        id: index,
        drawing: row['D'] || row['Drawing'] || '',
        system: row['D_1'] || row['System'] || '',
        floor: row['D_2'] || row['Floor'] || '',
        zone: row['D_3'] || row['Zone'] || '',
        symbol: row['D_4'] || row['Symbol'] || '',
        estimator: row['D_5'] || row['Estimator'] || '',
        materialSpec: row['D_6'] || row['Material Spec'] || '',
        itemType: row['D_7'] || row['Item Type'] || '',
        reportCat: row['D_8'] || row['Report Cat'] || '',
        trade: row['D_9'] || row['Trade'] || '',
        materialDesc: row['A'] || row['Material Description'] || '',
        itemName: row['A_1'] || row['Item Name'] || '',
        size: row['A_2'] || row['Size'] || '',
        quantity: parseFloat(row['T'] || row['Quantity'] || 0),
        listPrice: parseFloat(row['A_3'] || row['List Price'] || 0),
        materialDollars: parseFloat(row['T_1'] || row['Material Dollars'] || 0),
        weight: parseFloat(row['T_2'] || row['Weight'] || 0),
        hours: parseFloat(row['T_3'] || row['Hours'] || 0),
        laborDollars: parseFloat(row['T_4'] || row['Labor Dollars'] || 0),
        costCode: '',
        suggestedCodes: []
      };
      
      item.suggestedCodes = getSuggestedCostCodes(item);
      return item;
    });
  }, [getSuggestedCostCodes]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    
    setIsLoading(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Look for Raw Data sheet
      const sheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('raw') || 
        name.toLowerCase().includes('data')
      ) || workbook.SheetNames[0];
      
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      
      const processedData = processRawData(jsonData);
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