import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Upload, AlertTriangle, Download, Edit2 } from 'lucide-react';
import { useLaborCodes } from '@/hooks/useCostCodes';
import { MappingCombobox } from '@/components/MappingCombobox';
import { exportBudgetPacket, ProjectInfo as BudgetProjectInfo, ExportEstimateItem } from '@/utils/budgetExportSystem';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface RecapCategory {
  id: string;
  category: string;
  materialType: string;
  suggestedCostCode: string;
  assignedCostCode: string;
  description: string;
  totalQuantity: number;
  totalMaterialCost: number;
  totalHours: number;
  confidence: number;
}

interface PdfProjectInfo {
  projectName: string;
  bidId: string;
  reportDate: string;
}

// ============================================
// MATERIAL TYPE TO COST CODE MAPPING
// ============================================

const MATERIAL_TO_COST_CODE: Record<string, { code: string; description: string; confidence: number }> = {
  // Domestic Water / Potable
  'copper - type l': { code: 'DWTR', description: 'DOMESTIC WATER', confidence: 90 },
  'copper - type k': { code: 'DWTR', description: 'DOMESTIC WATER', confidence: 90 },
  'copper - type m': { code: 'DWTR', description: 'DOMESTIC WATER', confidence: 85 },
  'copper - pressure': { code: 'DWTR', description: 'DOMESTIC WATER', confidence: 85 },
  
  // Sanitary Waste & Vent
  'cpvc - plain end plastic': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 90 },
  'cpvc - hub x hub plastic dwv': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 90 },
  'cpvc dwv': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 95 },
  'pvc dwv': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 95 },
  'cast iron - no-hub': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 90 },
  'cast iron - hub': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 90 },
  
  // Storm Drain
  'storm': { code: 'STRM', description: 'STORM DRAIN', confidence: 95 },
  'roof drain': { code: 'STRM', description: 'STORM DRAIN', confidence: 90 },
  
  // Natural Gas
  'black steel': { code: 'NGAS', description: 'NATURAL GAS', confidence: 75 },
  'csst': { code: 'NGAS', description: 'NATURAL GAS', confidence: 90 },
  
  // Hangers & Supports
  'b-line': { code: 'HNGS', description: 'HANGERS & SUPPORTS', confidence: 95 },
  'unistrut': { code: 'HNGS', description: 'HANGERS & SUPPORTS', confidence: 95 },
  'carbon steel - angle': { code: 'HNGS', description: 'HANGERS & SUPPORTS', confidence: 85 },
  'carbon steel - multi-support': { code: 'HNGS', description: 'HANGERS & SUPPORTS', confidence: 85 },
  'stainless steel - anchors': { code: 'HNGS', description: 'HANGERS & SUPPORTS', confidence: 80 },
  
  // Fixtures
  'floor sinks': { code: 'FNSH', description: 'FIXTURES', confidence: 90 },
  'sinks': { code: 'FNSH', description: 'FIXTURES', confidence: 90 },
  'water closet': { code: 'FNSH', description: 'FIXTURES', confidence: 95 },
  'lavatory': { code: 'FNSH', description: 'FIXTURES', confidence: 95 },
  'urinal': { code: 'FNSH', description: 'FIXTURES', confidence: 95 },
  
  // Equipment
  'water heaters': { code: 'SEQP', description: 'EQUIPMENT SETTING', confidence: 85 },
  'backflow': { code: 'SEQP', description: 'EQUIPMENT SETTING', confidence: 85 },
  
  // Drains
  'cast iron - floor type': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 80 },
  'floor drain': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 80 },
  
  // Valves
  'bronze - soldered ball': { code: 'DWTR', description: 'DOMESTIC WATER', confidence: 75 },
  'bronze - soldered y strainer': { code: 'DWTR', description: 'DOMESTIC WATER', confidence: 75 },
  
  // Specialties
  'trap primers': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 85 },
  'identification': { code: 'HNGS', description: 'HANGERS & SUPPORTS', confidence: 60 },
  'access doors': { code: 'HNGS', description: 'HANGERS & SUPPORTS', confidence: 60 },
  
  // Penetrations & Sleeves
  'floor sleeves': { code: 'SLVS', description: 'SLEEVES & PENETRATIONS', confidence: 90 },
  'fire penetration': { code: 'SLVS', description: 'SLEEVES & PENETRATIONS', confidence: 90 },
  'flashing': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 70 },
};

const CATEGORY_TO_COST_CODE: Record<string, { code: string; description: string; confidence: number }> = {
  'pipe': { code: 'PIPE', description: 'MISC. PIPING', confidence: 50 },
  'nipples': { code: 'PIPE', description: 'MISC. PIPING', confidence: 50 },
  'fittings': { code: 'PIPE', description: 'MISC. PIPING', confidence: 50 },
  'valves': { code: 'VALV', description: 'VALVES', confidence: 70 },
  'drains': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 70 },
  'fixtures': { code: 'FNSH', description: 'FIXTURES', confidence: 80 },
  'flashing': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 60 },
  'penetrations': { code: 'SLVS', description: 'SLEEVES & PENETRATIONS', confidence: 80 },
  'plmbng.specialties': { code: 'SNWV', description: 'SANITARY WASTE & VENT', confidence: 60 },
  'sleeves': { code: 'SLVS', description: 'SLEEVES & PENETRATIONS', confidence: 85 },
  'specialties': { code: 'MISC', description: 'MISCELLANEOUS', confidence: 40 },
  'specialty items': { code: 'SEQP', description: 'EQUIPMENT SETTING', confidence: 60 },
  'struct attachments': { code: 'HNGS', description: 'HANGERS & SUPPORTS', confidence: 80 },
  'supports': { code: 'HNGS', description: 'HANGERS & SUPPORTS', confidence: 90 },
  'water heaters': { code: 'SEQP', description: 'EQUIPMENT SETTING', confidence: 85 },
};

// Pre-parsed data from the Relativity Bay 5 P2 PDF
const RELATIVITY_BAY5_P2_DATA: Omit<RecapCategory, 'id' | 'assignedCostCode'>[] = [
  { category: 'Pipe', materialType: 'Copper - Type L - 95/5', suggestedCostCode: 'DWTR', description: 'DOMESTIC WATER', totalQuantity: 656, totalMaterialCost: 8345, totalHours: 43, confidence: 90 },
  { category: 'Pipe', materialType: 'CPVC - Plain End Plastic Sch 40', suggestedCostCode: 'SNWV', description: 'SANITARY WASTE & VENT', totalQuantity: 2262, totalMaterialCost: 41173, totalHours: 150, confidence: 90 },
  { category: 'Nipples', materialType: 'Brass - Threaded Brass', suggestedCostCode: 'DWTR', description: 'DOMESTIC WATER', totalQuantity: 6, totalMaterialCost: 587, totalHours: 2, confidence: 75 },
  { category: 'Nipples', materialType: 'CPVC - Threaded Sch 80', suggestedCostCode: 'SNWV', description: 'SANITARY WASTE & VENT', totalQuantity: 6, totalMaterialCost: 0, totalHours: 6, confidence: 85 },
  { category: 'Fittings', materialType: 'Copper - Pressure - 95/5', suggestedCostCode: 'DWTR', description: 'DOMESTIC WATER', totalQuantity: 105, totalMaterialCost: 998, totalHours: 32, confidence: 85 },
  { category: 'Fittings', materialType: 'CPVC - Hub x Hub Plastic DWV', suggestedCostCode: 'SNWV', description: 'SANITARY WASTE & VENT', totalQuantity: 239, totalMaterialCost: 20482, totalHours: 134, confidence: 90 },
  { category: 'Valves', materialType: 'Bronze - Soldered Ball', suggestedCostCode: 'DWTR', description: 'DOMESTIC WATER', totalQuantity: 6, totalMaterialCost: 123, totalHours: 2, confidence: 75 },
  { category: 'Valves', materialType: 'Bronze - Soldered Y Strainer', suggestedCostCode: 'DWTR', description: 'DOMESTIC WATER', totalQuantity: 1, totalMaterialCost: 186, totalHours: 0, confidence: 75 },
  { category: 'Drains', materialType: 'Floor Sinks', suggestedCostCode: 'SNWV', description: 'SANITARY WASTE & VENT', totalQuantity: 11, totalMaterialCost: 0, totalHours: 11, confidence: 80 },
  { category: 'Drains', materialType: 'Cast Iron - Floor Type', suggestedCostCode: 'SNWV', description: 'SANITARY WASTE & VENT', totalQuantity: 10, totalMaterialCost: 4032, totalHours: 10, confidence: 80 },
  { category: 'Fixtures', materialType: 'Sinks Commercial-2 Comp.', suggestedCostCode: 'FNSH', description: 'FIXTURES', totalQuantity: 5, totalMaterialCost: 0, totalHours: 13, confidence: 90 },
  { category: 'Flashing', materialType: 'Lead - Lead 4LB', suggestedCostCode: 'SNWV', description: 'SANITARY WASTE & VENT', totalQuantity: 3, totalMaterialCost: 287, totalHours: 2, confidence: 70 },
  { category: 'Penetrations', materialType: 'Fire Penetration', suggestedCostCode: 'SLVS', description: 'SLEEVES & PENETRATIONS', totalQuantity: 3, totalMaterialCost: 0, totalHours: 0, confidence: 90 },
  { category: 'Plmbng.Specialties', materialType: 'Trap Primers Distribution', suggestedCostCode: 'SNWV', description: 'SANITARY WASTE & VENT', totalQuantity: 5, totalMaterialCost: 286, totalHours: 3, confidence: 85 },
  { category: 'Plmbng.Specialties', materialType: 'Trap Primer Valves', suggestedCostCode: 'SNWV', description: 'SANITARY WASTE & VENT', totalQuantity: 5, totalMaterialCost: 261, totalHours: 2, confidence: 85 },
  { category: 'Sleeves', materialType: 'Floor Sleeves - Core Drill', suggestedCostCode: 'SLVS', description: 'SLEEVES & PENETRATIONS', totalQuantity: 3, totalMaterialCost: 90, totalHours: 3, confidence: 90 },
  { category: 'Specialties', materialType: 'Identification', suggestedCostCode: 'HNGS', description: 'HANGERS & SUPPORTS', totalQuantity: 2918, totalMaterialCost: 373, totalHours: 29, confidence: 60 },
  { category: 'Specialties', materialType: 'Point of Connection', suggestedCostCode: 'MISC', description: 'MISCELLANEOUS', totalQuantity: 3, totalMaterialCost: 0, totalHours: 7, confidence: 50 },
  { category: 'Specialties', materialType: 'Carbon Steel - Access Doors', suggestedCostCode: 'HNGS', description: 'HANGERS & SUPPORTS', totalQuantity: 5, totalMaterialCost: 113, totalHours: 0, confidence: 60 },
  { category: 'Specialty Items', materialType: 'Backflow Preventers', suggestedCostCode: 'SEQP', description: 'EQUIPMENT SETTING', totalQuantity: 1, totalMaterialCost: 0, totalHours: 12, confidence: 85 },
  { category: 'Struct Attachments', materialType: 'Carbon Steel - Angle Iron', suggestedCostCode: 'HNGS', description: 'HANGERS & SUPPORTS', totalQuantity: 1, totalMaterialCost: 44, totalHours: 0, confidence: 85 },
  { category: 'Struct Attachments', materialType: 'Carbon Steel - Multi-Support', suggestedCostCode: 'HNGS', description: 'HANGERS & SUPPORTS', totalQuantity: 3, totalMaterialCost: 0, totalHours: 1, confidence: 85 },
  { category: 'Supports', materialType: 'B-Line', suggestedCostCode: 'HNGS', description: 'HANGERS & SUPPORTS', totalQuantity: 147, totalMaterialCost: 443, totalHours: 26, confidence: 95 },
  { category: 'Supports', materialType: 'Stainless Steel - Anchors', suggestedCostCode: 'HNGS', description: 'HANGERS & SUPPORTS', totalQuantity: 74, totalMaterialCost: 131, totalHours: 3, confidence: 80 },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function suggestCostCode(materialType: string, category: string): { code: string; description: string; confidence: number } {
  const matLower = materialType.toLowerCase();
  const catLower = category.toLowerCase();
  
  for (const [pattern, mapping] of Object.entries(MATERIAL_TO_COST_CODE)) {
    if (matLower.includes(pattern)) {
      return mapping;
    }
  }
  
  for (const [pattern, mapping] of Object.entries(CATEGORY_TO_COST_CODE)) {
    if (catLower.includes(pattern)) {
      return mapping;
    }
  }
  
  return { code: 'MISC', description: 'MISCELLANEOUS', confidence: 20 };
}

function getConfidenceBadge(confidence: number) {
  if (confidence >= 85) return { variant: 'default' as const, label: 'High', className: 'bg-green-500 hover:bg-green-600' };
  if (confidence >= 60) return { variant: 'secondary' as const, label: 'Medium', className: 'bg-yellow-500 hover:bg-yellow-600 text-black' };
  return { variant: 'destructive' as const, label: 'Low', className: 'bg-red-500 hover:bg-red-600' };
}

// ============================================
// COMPONENT
// ============================================

interface PdfImportTabProps {
  projectName?: string;
  onExportComplete?: () => void;
}

export const PdfImportTab: React.FC<PdfImportTabProps> = ({ projectName, onExportComplete }) => {
  const [categories, setCategories] = useState<RecapCategory[]>([]);
  const [projectInfo, setProjectInfo] = useState<PdfProjectInfo>({
    projectName: projectName || '',
    bidId: '',
    reportDate: new Date().toLocaleDateString()
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const { data: laborCodes = [] } = useLaborCodes();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load the pre-parsed PDF data (simulated PDF import)
  const handleLoadPdfData = useCallback(() => {
    const loadedCategories: RecapCategory[] = RELATIVITY_BAY5_P2_DATA.map((item, index) => ({
      ...item,
      id: `cat-${index}`,
      assignedCostCode: item.suggestedCostCode,
    }));
    
    setCategories(loadedCategories);
    setProjectInfo({
      projectName: 'Relativity Bay 5 - P2 Plumbing',
      bidId: '2680-25',
      reportDate: new Date().toLocaleDateString()
    });
    setIsLoaded(true);
    toast.success(`Loaded ${loadedCategories.length} material categories from PDF`);
  }, []);

  // Update cost code for a category
  const handleCostCodeChange = useCallback((id: string, newCode: string) => {
    setCategories(prev => prev.map(cat => 
      cat.id === id ? { ...cat, assignedCostCode: newCode } : cat
    ));
    setEditingId(null);
  }, []);

  // Calculate totals
  const totals = React.useMemo(() => {
    return categories.reduce((acc, cat) => ({
      hours: acc.hours + cat.totalHours,
      material: acc.material + cat.totalMaterialCost,
      items: acc.items + 1
    }), { hours: 0, material: 0, items: 0 });
  }, [categories]);

  // Aggregate by cost code for export
  const aggregatedByCostCode = React.useMemo(() => {
    const aggregated = new Map<string, { code: string; description: string; hours: number; material: number }>();
    
    for (const cat of categories) {
      const code = cat.assignedCostCode;
      const existing = aggregated.get(code);
      
      if (existing) {
        existing.hours += cat.totalHours;
        existing.material += cat.totalMaterialCost;
      } else {
        aggregated.set(code, {
          code,
          description: cat.description,
          hours: cat.totalHours,
          material: cat.totalMaterialCost
        });
      }
    }
    
    return Array.from(aggregated.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [categories]);

  // Export Budget Packet
  const handleExport = useCallback(() => {
    if (categories.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Convert to export format
    const exportItems: ExportEstimateItem[] = categories.map((cat, index) => ({
      id: `pdf-${index}`,
      costCode: cat.assignedCostCode,
      materialCostCode: '',
      hours: cat.totalHours,
      laborDollars: cat.totalHours * 85, // Default labor rate
      materialDollars: cat.totalMaterialCost,
      materialDesc: cat.materialType,
      itemName: cat.category,
      quantity: cat.totalQuantity,
      system: cat.category,
    }));

    const budgetProjectInfo: BudgetProjectInfo = {
      jobNumber: projectInfo.bidId,
      jobName: projectInfo.projectName,
      date: new Date(),
      preparedBy: 'System'
    };

    try {
      const result = exportBudgetPacket(exportItems, budgetProjectInfo);
      toast.success(`Exported Budget Packet with ${result.laborCodes} cost codes`);
      onExportComplete?.();
    } catch (error) {
      toast.error('Failed to export Budget Packet');
      console.error(error);
    }
  }, [categories, projectInfo, onExportComplete]);

  // Stats
  const stats = React.useMemo(() => {
    const highConfidence = categories.filter(c => c.confidence >= 85).length;
    const lowConfidence = categories.filter(c => c.confidence < 60).length;
    return { highConfidence, lowConfidence, total: categories.length };
  }, [categories]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">PDF Recap Import</h2>
          <p className="text-muted-foreground">Import AutoBid Recap with Total Cost PDF reports</p>
        </div>
        {isLoaded && (
          <Button onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export Budget Packet
          </Button>
        )}
      </div>

      {/* Upload Area */}
      {!isLoaded ? (
        <Card className="border-2 border-dashed border-primary/30 hover:border-primary/50 transition-colors">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Import AutoBid Recap PDF</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Upload a "Recap with Total Cost" PDF from AutoBid to generate a Budget Packet.
              The system will auto-suggest cost codes based on material types.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleLoadPdfData} className="gap-2">
                <Upload className="w-4 h-4" />
                Load Sample PDF Data
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <FileText className="w-4 h-4" />
                Upload PDF (Coming Soon)
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              disabled
            />
            <p className="text-xs text-muted-foreground mt-4">
              Note: PDF parsing requires server-side processing. Currently showing pre-parsed data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-0">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Material Categories</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-0">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Total Hours</p>
                <p className="text-3xl font-bold text-green-900 dark:text-green-100">{totals.hours.toFixed(0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-0">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Material Cost</p>
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">${totals.material.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-0">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">High Confidence</p>
                <p className="text-3xl font-bold text-amber-900 dark:text-amber-100">{stats.highConfidence}/{stats.total}</p>
              </CardContent>
            </Card>
          </div>

          {/* Low Confidence Warning */}
          {stats.lowConfidence > 0 && (
            <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  {stats.lowConfidence} categories have low confidence mappings
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Review and update these before exporting your Budget Packet
                </p>
              </div>
            </div>
          )}

          {/* Category Mapping Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Material Category Mappings</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Click on a cost code to change it
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-left p-3 font-medium">Material Type</th>
                      <th className="text-right p-3 font-medium">Hours</th>
                      <th className="text-right p-3 font-medium">Material $</th>
                      <th className="text-left p-3 font-medium">Cost Code</th>
                      <th className="text-center p-3 font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => {
                      const confidenceBadge = getConfidenceBadge(cat.confidence);
                      const isEditing = editingId === cat.id;
                      
                      return (
                        <tr key={cat.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-3 font-medium">{cat.category}</td>
                          <td className="p-3 text-muted-foreground">{cat.materialType}</td>
                          <td className="p-3 text-right font-mono">{cat.totalHours}</td>
                          <td className="p-3 text-right font-mono">${cat.totalMaterialCost.toLocaleString()}</td>
                          <td className="p-3">
                            {isEditing ? (
                              <MappingCombobox
                                value={cat.assignedCostCode}
                                onChange={(code) => handleCostCodeChange(cat.id, code)}
                                className="w-48"
                              />
                            ) : (
                              <button
                                onClick={() => setEditingId(cat.id)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors group"
                              >
                                <span className="font-mono font-medium">{cat.assignedCostCode}</span>
                                <span className="text-xs text-muted-foreground">- {cat.description}</span>
                                <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <Badge className={confidenceBadge.className}>
                              {cat.confidence}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Aggregated Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Budget Summary by Cost Code</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aggregatedByCostCode.map(item => (
                  <div key={item.code} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-mono font-bold text-lg">{item.code}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{item.hours} hrs</p>
                      <p className="text-sm text-muted-foreground">${item.material.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Grand Totals */}
              <div className="mt-6 pt-6 border-t flex items-center justify-between">
                <div className="text-lg font-semibold">Grand Totals</div>
                <div className="flex gap-8">
                  <div>
                    <span className="text-muted-foreground mr-2">Hours:</span>
                    <span className="font-bold text-lg">{totals.hours}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground mr-2">Material:</span>
                    <span className="font-bold text-lg">${totals.material.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
