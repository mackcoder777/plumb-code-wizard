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
      
      const allCodes: Array<{
        code: string;
        description: string;
        category: 'L' | 'M';
        subcategory?: string;
        units?: string;
      }> = [];

      let laborCount = 0;
      let materialCount = 0;

      // Process each sheet - category is determined ONLY by sheet name
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        if (jsonData.length === 0) {
          console.log(`Skipping empty sheet: "${sheetName}"`);
          continue;
        }

        // Determine category from sheet name ONLY - ignore any category column
        const sheetNameLower = sheetName.toLowerCase();
        let sheetCategory: 'L' | 'M' = 'L';
        if (sheetNameLower.includes('material')) {
          sheetCategory = 'M';
        }
        
        console.log(`Processing sheet: "${sheetName}" as ${sheetCategory === 'M' ? 'Material' : 'Labor'}`);

        // Get headers
        const firstRow = jsonData[0] as any;
        const originalHeaders = Object.keys(firstRow);
        const headersLower = originalHeaders.map(h => h.toLowerCase().trim());
        
        console.log(`Sheet "${sheetName}" headers:`, originalHeaders);

        // Find columns - support both standard and Murray Company format
        // Standard format: Code, Description, Category, Units
        // Murray format: Typical Phase, Activity, Cost Head, Description, Un, Default Category
        
        // Try to find Cost Head column (Murray format)
        const costHeadIdx = headersLower.findIndex(h => 
          h.includes('cost head') || h === 'costhead' || h === 'cost_head'
        );
        
        // Try to find standard Code column
        const codeIdx = headersLower.findIndex(h => 
          h === 'code' || h === 'id' || h === 'number' || h === 'cost code'
        );
        
        // Find description columns - there might be multiple
        const descIndices = headersLower.map((h, i) => 
          (h.includes('desc') || h === 'name' || h === 'title') ? i : -1
        ).filter(i => i !== -1);
        
        // Find units column
        const unitsIdx = headersLower.findIndex(h => 
          h === 'un' || h === 'units' || h === 'uom' || h === 'unit'
        );

        // Find subcategory/phase column
        const phaseIdx = headersLower.findIndex(h => 
          h.includes('phase') || h.includes('section') || h.includes('sub')
        );

        // Determine which code column to use
        const useCodeIdx = costHeadIdx !== -1 ? costHeadIdx : codeIdx;
        
        // For Murray format, use the LAST description column (the detailed one)
        // For standard format, use the first/only description column
        const useDescIdx = descIndices.length > 1 ? descIndices[descIndices.length - 1] : descIndices[0];

        if (useCodeIdx === -1 || useDescIdx === undefined || useDescIdx === -1) {
          console.log(`Skipping sheet "${sheetName}": missing code or description columns`);
          continue;
        }

        let sheetCodesCount = 0;

        // Map the data
        for (const row of jsonData) {
          const rowData = row as any;
          
          const codeKey = originalHeaders[useCodeIdx];
          const descKey = originalHeaders[useDescIdx];
          
          const code = String(rowData[codeKey] || '').trim().toUpperCase();
          const description = String(rowData[descKey] || '').trim();
          
          // Skip empty rows or header-like rows
          if (!code || !description || 
              code.toLowerCase() === 'cost head' || 
              description.toLowerCase() === 'description') {
            continue;
          }

          // Category is determined ONLY by sheet name - NO OVERRIDE from column
          const category = sheetCategory;

          // Get units
          let units: string | undefined;
          if (unitsIdx !== -1) {
            const unitsKey = originalHeaders[unitsIdx];
            units = String(rowData[unitsKey] || '').trim() || undefined;
          }

          // Get subcategory/phase
          let subcategory: string | undefined;
          if (phaseIdx !== -1) {
            const phaseKey = originalHeaders[phaseIdx];
            subcategory = String(rowData[phaseKey] || '').trim() || undefined;
          }

          allCodes.push({
            code,
            description: description.toUpperCase(),
            category,
            subcategory,
            units,
          });
          
          sheetCodesCount++;
          if (category === 'L') laborCount++;
          else materialCount++;
        }
        
        console.log(`Sheet "${sheetName}": extracted ${sheetCodesCount} codes as ${sheetCategory === 'M' ? 'Material' : 'Labor'}`);
      }

      if (allCodes.length === 0) {
        toast({
          title: "No Valid Data",
          description: "Could not extract any valid cost codes from the file. Check that your file has 'Cost Head' or 'Code' and 'Description' columns.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      console.log(`Total before deduplication: ${allCodes.length} (${laborCount} Labor, ${materialCount} Material)`);

      // Remove duplicates based on code AND category (same code can exist as both Labor and Material)
      const uniqueCodes = allCodes.filter((code, index, self) =>
        index === self.findIndex((c) => c.code === code.code && c.category === code.category)
      );
      
      const uniqueLabor = uniqueCodes.filter(c => c.category === 'L').length;
      const uniqueMaterial = uniqueCodes.filter(c => c.category === 'M').length;
      
      console.log(`Total after deduplication: ${uniqueCodes.length} (${uniqueLabor} Labor, ${uniqueMaterial} Material)`);
      console.log(`Duplicates removed: ${allCodes.length - uniqueCodes.length}`);

      setPreview(uniqueCodes.slice(0, 5));
      
      toast({
        title: "File Processed",
        description: `Found ${uniqueCodes.length} codes (${uniqueLabor} Labor, ${uniqueMaterial} Material) from ${workbook.SheetNames.length} sheets.`,
      });

      // Auto-import after preview
      setTimeout(() => {
        onImport(uniqueCodes);
        toast({
          title: "Import Complete",
          description: `Successfully imported ${uniqueCodes.length} cost codes.`,
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
                    <span className="text-muted-foreground ml-2">({code.category === 'L' ? 'Labor' : 'Material'})</span>
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
                  <p className="font-semibold">Supported formats:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Murray format:</strong> Cost Head, Description, Un (Units)</li>
                    <li><strong>Standard format:</strong> Code, Description, Category</li>
                    <li>Multiple sheets supported (Field Labor, GC Labor, Material)</li>
                    <li>Category auto-detected from sheet name</li>
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
                <li>• File should have column headers in the first row</li>
                <li>• "Cost Head" or "Code" column contains the code identifier (e.g., PLMB, PIPE, INJR)</li>
                <li>• "Description" column has the code name (e.g., PLUMBERS, PIPEFITTERS)</li>
                <li>• Sheet names like "Field Labor", "Material" auto-set the category</li>
                <li>• Supports .xlsx, .xls, and .csv files</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
