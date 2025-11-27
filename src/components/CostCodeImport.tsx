import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface CostCodeImportProps {
  onImport: (codes: Array<{
    code: string;
    description: string;
    category: 'L' | 'M';
    subcategory?: string;
    units?: string;
  }>) => void;
  onClose?: () => void;
}

export const CostCodeImport: React.FC<CostCodeImportProps> = ({ onImport, onClose }) => {
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const { toast } = useToast();

  const processFile = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Try to find the right sheet
      const sheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('cost') || 
        name.toLowerCase().includes('code') ||
        name.toLowerCase().includes('labor') ||
        name.toLowerCase().includes('material')
      ) || workbook.SheetNames[0];
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      if (jsonData.length === 0) {
        toast({
          title: "Empty File",
          description: "The uploaded file contains no data.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Detect column names (flexible mapping)
      const firstRow = jsonData[0] as any;
      const headers = Object.keys(firstRow).map(h => h.toLowerCase());
      
      const codeCol = headers.find(h => 
        h.includes('code') || h === 'id' || h === 'number'
      );
      const descCol = headers.find(h => 
        h.includes('desc') || h.includes('name') || h.includes('title')
      );
      const catCol = headers.find(h => 
        h.includes('cat') || h.includes('type')
      );
      const subcatCol = headers.find(h => 
        h.includes('sub') || h.includes('group')
      );
      const unitsCol = headers.find(h => 
        h.includes('unit') || h.includes('uom')
      );

      if (!codeCol || !descCol) {
        toast({
          title: "Invalid Format",
          description: "Could not find 'code' and 'description' columns. Please ensure your file has these columns.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Map the data
      const mappedCodes = jsonData.map((row: any) => {
        const originalKeys = Object.keys(firstRow);
        const codeKey = originalKeys[headers.indexOf(codeCol)];
        const descKey = originalKeys[headers.indexOf(descCol)];
        const catKey = catCol ? originalKeys[headers.indexOf(catCol)] : null;
        const subcatKey = subcatCol ? originalKeys[headers.indexOf(subcatCol)] : null;
        const unitsKey = unitsCol ? originalKeys[headers.indexOf(unitsCol)] : null;

        const code = String(row[codeKey] || '').trim();
        const description = String(row[descKey] || '').trim();
        
        if (!code || !description) return null;

        // Determine category (L for Labor, M for Material)
        let category: 'L' | 'M' = 'L';
        if (catKey) {
          const catValue = String(row[catKey]).toLowerCase();
          if (catValue.includes('m') || catValue.includes('mat')) {
            category = 'M';
          }
        } else {
          // Auto-detect from description
          const desc = description.toLowerCase();
          if (desc.includes('material') || desc.includes('mat\'l') || 
              desc.includes('pipe') || desc.includes('fitting')) {
            category = 'M';
          }
        }

        return {
          code,
          description: description.toUpperCase(),
          category,
          subcategory: subcatKey ? String(row[subcatKey] || '').trim() : undefined,
          units: unitsKey ? String(row[unitsKey] || '').trim() : undefined,
        };
      }).filter(Boolean);

      if (mappedCodes.length === 0) {
        toast({
          title: "No Valid Data",
          description: "Could not extract any valid cost codes from the file.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      setPreview(mappedCodes.slice(0, 5));
      
      toast({
        title: "File Processed",
        description: `Found ${mappedCodes.length} cost codes. Review and confirm import.`,
      });

      // Auto-import if preview looks good
      setTimeout(() => {
        onImport(mappedCodes);
        toast({
          title: "Import Complete",
          description: `Successfully imported ${mappedCodes.length} cost codes.`,
        });
        if (onClose) onClose();
      }, 1500);

    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: "Import Failed",
        description: "Failed to process the file. Please check the format and try again.",
        variant: "destructive",
      });
    }
    
    setIsProcessing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      processFile(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload an Excel (.xlsx, .xls) or CSV file.",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-muted'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        <CardContent className="p-8">
          {isProcessing ? (
            <div className="text-center space-y-4">
              <div className="animate-spin mx-auto h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
              <p className="text-sm text-muted-foreground">Processing file...</p>
            </div>
          ) : preview.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-success">
                <CheckCircle className="h-8 w-8" />
                <p className="text-lg font-semibold">Preview Ready</p>
              </div>
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Sample of imported codes:</p>
                {preview.map((code, idx) => (
                  <div key={idx} className="text-xs font-mono bg-background p-2 rounded">
                    <span className="font-bold">{code.code}</span> - {code.description} 
                    <span className="text-muted-foreground ml-2">({code.category})</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Importing codes automatically...
              </p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Import Cost Code Library</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload your company's cost code library from Excel or CSV
                </p>
                <div className="space-y-2 text-xs text-muted-foreground text-left max-w-md mx-auto bg-muted p-4 rounded-lg">
                  <p className="font-semibold">Expected format:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Required columns: <strong>Code</strong>, <strong>Description</strong></li>
                    <li>Optional: Category (L/M), Subcategory, Units</li>
                    <li>Supports .xlsx, .xls, and .csv files</li>
                  </ul>
                </div>
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={() => document.getElementById('cost-code-file-input')?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Choose File
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                or drag and drop your file here
              </p>
              <input
                id="cost-code-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-info shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Tips for successful import:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Ensure your file has column headers in the first row</li>
                <li>• Code column should contain unique identifiers (e.g., COMP, DWTR, SNWV)</li>
                <li>• Description column should have clear, readable names</li>
                <li>• Category can be "L" (Labor), "M" (Material), or keywords like "labor"/"material"</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
