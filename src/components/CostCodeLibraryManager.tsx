import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, AlertTriangle, Plus, Download, Upload, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface CostCode {
  costHead: string;
  description: string;
  category: string;
  sheet: 'Field Labor' | 'GC Labor' | 'Material';
  units: string;
  phase?: string;
  defaultCategory?: string;
}

interface CostCodeLibraryManagerProps {
  initialCodes?: CostCode[];
  onCodesUpdate?: (codes: CostCode[]) => void;
  onCodeSelect?: (code: CostCode) => void;
  showSelector?: boolean;
}

const MISSING_CODES: Partial<CostCode>[] = [
  { costHead: 'REBAR', description: 'REINFORCING STEEL', sheet: 'Field Labor' },
  { costHead: 'COMPACT', description: 'COMPACTION', sheet: 'Field Labor' },
  { costHead: 'QUAL', description: 'QUALITY CONTROL', sheet: 'Field Labor' },
  { costHead: 'CEIL', description: 'CEILING WORK', sheet: 'Field Labor' },
  { costHead: 'DOOR', description: 'DOORS AND FRAMES', sheet: 'Material' },
  { costHead: 'WIND', description: 'WINDOWS', sheet: 'Material' },
  { costHead: 'STRUCT', description: 'STRUCTURAL STEEL', sheet: 'Material' },
  { costHead: 'FOUND', description: 'FOUNDATION', sheet: 'Field Labor' },
  { costHead: 'SLAB', description: 'SLAB ON GRADE', sheet: 'Field Labor' },
  { costHead: 'FRAME', description: 'FRAMING', sheet: 'Field Labor' }
];

const SAMPLE_CODES: CostCode[] = [
  { costHead: 'SZMC', description: 'SEISMIC', category: 'FIELD WORK', sheet: 'Field Labor', units: 'HRS', phase: '95' },
  { costHead: 'INJR', description: 'INJURY', category: 'NONREIMBURSABLE', sheet: 'Field Labor', units: 'HRS', phase: '89' },
  { costHead: 'PNCH', description: 'PUNCH LIST', category: 'NONREIMBURSABLE', sheet: 'Field Labor', units: 'HRS', phase: '89' },
  { costHead: 'PLMB', description: 'PLUMBING LABOR', category: 'REIMBURSABLE CHANGE', sheet: 'Field Labor', units: 'HRS', phase: '99' },
  { costHead: 'CONC', description: 'CONCRETE WORK', category: 'FIELD WORK', sheet: 'Field Labor', units: 'CY', phase: '03' },
  { costHead: 'STEEL', description: 'STRUCTURAL STEEL', category: 'MATERIALS', sheet: 'Material', units: 'LB', phase: '05' },
  { costHead: 'WELD', description: 'WELDING', category: 'FIELD WORK', sheet: 'Field Labor', units: 'HRS', phase: '05' },
  { costHead: 'DEMO', description: 'DEMOLITION', category: 'FIELD WORK', sheet: 'Field Labor', units: 'HRS', phase: '02' },
  { costHead: 'EXCAV', description: 'EXCAVATION', category: 'FIELD WORK', sheet: 'Field Labor', units: 'CY', phase: '31' },
  { costHead: 'FIRE', description: 'FIRE PROTECTION', category: 'FIELD WORK', sheet: 'Field Labor', units: 'HRS', phase: '21' },
  { costHead: 'TEST', description: 'TESTING', category: 'FIELD WORK', sheet: 'Field Labor', units: 'HRS', phase: '01' },
  { costHead: 'SAFE', description: 'SAFETY', category: 'GENERAL CONDITIONS', sheet: 'GC Labor', units: 'HRS', phase: '01' },
  { costHead: 'CLEAN', description: 'CLEANUP', category: 'GENERAL CONDITIONS', sheet: 'GC Labor', units: 'HRS', phase: '01' },
  { costHead: '9527', description: 'SEISMIC', category: 'MATERIALS', sheet: 'Material', units: 'EA', phase: '95' },
  { costHead: '9629', description: 'SEISMIC DESIGN', category: 'MATERIALS', sheet: 'Material', units: 'EA', phase: '96' },
  { costHead: 'DTLS', description: 'DETAILING SEISMIC', category: 'MATERIALS', sheet: 'Material', units: 'HRS', phase: '95' }
];

export const CostCodeLibraryManager: React.FC<CostCodeLibraryManagerProps> = ({
  initialCodes = SAMPLE_CODES,
  onCodesUpdate,
  onCodeSelect,
  showSelector = false
}) => {
  const [allCodes, setAllCodes] = useState<CostCode[]>(initialCodes);
  const [filteredCodes, setFilteredCodes] = useState<CostCode[]>(initialCodes);
  const [searchCostHead, setSearchCostHead] = useState("");
  const [searchDescription, setSearchDescription] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSheet, setFilterSheet] = useState("");
  const [showMissing, setShowMissing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCode, setEditingCode] = useState<CostCode | null>(null);
  
  const [newCode, setNewCode] = useState<Partial<CostCode>>({
    costHead: '',
    description: '',
    category: 'FIELD WORK',
    sheet: 'Field Labor',
    units: 'HRS',
    phase: ''
  });

  const { toast } = useToast();

  const categories = useMemo(() => {
    return [...new Set(allCodes.map(code => code.category))].filter(Boolean).sort();
  }, [allCodes]);

  const missingCodes = useMemo(() => {
    return MISSING_CODES.filter(missing => 
      !allCodes.some(code => code.costHead === missing.costHead)
    );
  }, [allCodes]);

  const stats = useMemo(() => ({
    total: allCodes.length,
    missing: missingCodes.length,
    filtered: filteredCodes.length,
    bySheet: {
      'Field Labor': allCodes.filter(code => code.sheet === 'Field Labor').length,
      'GC Labor': allCodes.filter(code => code.sheet === 'GC Labor').length,
      'Material': allCodes.filter(code => code.sheet === 'Material').length,
    }
  }), [allCodes, filteredCodes, missingCodes]);

  const performSearch = () => {
    let filtered = allCodes;

    if (showMissing) {
      filtered = missingCodes.map(missing => ({
        costHead: missing.costHead!,
        description: missing.description!,
        category: 'SUGGESTED',
        sheet: missing.sheet!,
        units: 'TBD',
        phase: 'TBD'
      }));
    } else {
      if (searchCostHead) {
        filtered = filtered.filter(code => 
          code.costHead.toUpperCase().includes(searchCostHead.toUpperCase())
        );
      }

      if (searchDescription) {
        filtered = filtered.filter(code => 
          code.description.toUpperCase().includes(searchDescription.toUpperCase())
        );
      }

      if (filterCategory) {
        filtered = filtered.filter(code => code.category === filterCategory);
      }

      if (filterSheet) {
        filtered = filtered.filter(code => code.sheet === filterSheet);
      }
    }

    setFilteredCodes(filtered);
  };

  useEffect(() => {
    performSearch();
  }, [searchCostHead, searchDescription, filterCategory, filterSheet, showMissing, allCodes]);

  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-warning/30 px-1 rounded">{part}</span>
      ) : part
    );
  };

  const getSheetBadgeVariant = (sheet: string) => {
    switch (sheet) {
      case 'Field Labor': return 'default';
      case 'GC Labor': return 'secondary';
      case 'Material': return 'outline';
      default: return 'default';
    }
  };

  const handleAddCode = () => {
    if (!newCode.costHead || !newCode.description) {
      toast({
        title: "Validation Error",
        description: "Cost Head and Description are required",
        variant: "destructive",
      });
      return;
    }

    if (allCodes.some(code => code.costHead === newCode.costHead)) {
      toast({
        title: "Duplicate Code",
        description: "This cost head already exists",
        variant: "destructive",
      });
      return;
    }

    const codeToAdd: CostCode = {
      costHead: newCode.costHead!.toUpperCase(),
      description: newCode.description!.toUpperCase(),
      category: newCode.category!,
      sheet: newCode.sheet!,
      units: newCode.units!,
      phase: newCode.phase
    };

    const updatedCodes = [...allCodes, codeToAdd];
    setAllCodes(updatedCodes);
    onCodesUpdate?.(updatedCodes);
    
    setShowAddModal(false);
    setNewCode({
      costHead: '',
      description: '',
      category: 'FIELD WORK',
      sheet: 'Field Labor',
      units: 'HRS',
      phase: ''
    });

    toast({
      title: "Code Added",
      description: `Cost code ${codeToAdd.costHead} added successfully`,
    });
  };

  const handleDeleteCode = (costHead: string) => {
    const updatedCodes = allCodes.filter(code => code.costHead !== costHead);
    setAllCodes(updatedCodes);
    onCodesUpdate?.(updatedCodes);
    
    toast({
      title: "Code Deleted",
      description: `Cost code ${costHead} deleted successfully`,
    });
  };

  const exportCodes = () => {
    const csv = ['Cost Head,Description,Category,Sheet,Units,Phase'];
    filteredCodes.forEach(code => {
      csv.push(`${code.costHead},"${code.description}","${code.category}",${code.sheet},${code.units},"${code.phase || ''}"`);
    });

    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cost_codes_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <Card className="gradient-card">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold">📊 Cost Code Library Manager</CardTitle>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Codes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">{stats.missing}</div>
                <div className="text-sm text-muted-foreground">Missing</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{stats.filtered}</div>
                <div className="text-sm text-muted-foreground">Filtered</div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Missing Codes Alert */}
      {stats.missing > 0 && (
        <Alert className="border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex justify-between items-center">
              <span>
                <strong>{stats.missing} standard construction codes are missing</strong> from your library. 
                This may affect project cost tracking accuracy.
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowMissing(!showMissing)}
              >
                {showMissing ? 'Hide Missing' : 'View Missing'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Cost Head (e.g., SZMC, SEISMIC)"
                value={searchCostHead}
                onChange={(e) => setSearchCostHead(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Description"
                value={searchDescription}
                onChange={(e) => setSearchDescription(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button 
              onClick={performSearch}
              className="gradient-primary"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Label>Category:</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label>Sheet:</Label>
              <Select value={filterSheet} onValueChange={setFilterSheet}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Sheets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Sheets</SelectItem>
                  <SelectItem value="Field Labor">Field Labor</SelectItem>
                  <SelectItem value="GC Labor">GC Labor</SelectItem>
                  <SelectItem value="Material">Material</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-success text-success hover:bg-success hover:text-success-foreground">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Code
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Cost Code</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Cost Head *</Label>
                    <Input
                      placeholder="e.g., CONC, REBAR"
                      value={newCode.costHead}
                      onChange={(e) => setNewCode({...newCode, costHead: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Description *</Label>
                    <Textarea
                      placeholder="Enter description"
                      value={newCode.description}
                      onChange={(e) => setNewCode({...newCode, description: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Category</Label>
                      <Select value={newCode.category} onValueChange={(value) => setNewCode({...newCode, category: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FIELD WORK">Field Work</SelectItem>
                          <SelectItem value="MATERIALS">Materials</SelectItem>
                          <SelectItem value="GENERAL CONDITIONS">General Conditions</SelectItem>
                          <SelectItem value="CONTRACT LABOR">Contract Labor</SelectItem>
                          <SelectItem value="SUBCONTRACT">Subcontract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Sheet</Label>
                      <Select value={newCode.sheet} onValueChange={(value: any) => setNewCode({...newCode, sheet: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Field Labor">Field Labor</SelectItem>
                          <SelectItem value="GC Labor">GC Labor</SelectItem>
                          <SelectItem value="Material">Material</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Units</Label>
                      <Select value={newCode.units} onValueChange={(value) => setNewCode({...newCode, units: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HRS">HRS - Hours</SelectItem>
                          <SelectItem value="EA">EA - Each</SelectItem>
                          <SelectItem value="LS">LS - Lump Sum</SelectItem>
                          <SelectItem value="LF">LF - Linear Feet</SelectItem>
                          <SelectItem value="SF">SF - Square Feet</SelectItem>
                          <SelectItem value="CY">CY - Cubic Yards</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Phase</Label>
                      <Input
                        placeholder="Phase number"
                        value={newCode.phase}
                        onChange={(e) => setNewCode({...newCode, phase: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setShowAddModal(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddCode} className="gradient-primary">
                      Add Code
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={exportCodes}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          {filteredCodes.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50">
                  <TableRow>
                    <TableHead>Cost Head</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Sheet</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Phase</TableHead>
                    {!showSelector && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCodes.map((code, index) => (
                    <TableRow 
                      key={`${code.costHead}-${index}`} 
                      className={showSelector ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={showSelector ? () => onCodeSelect?.(code) : undefined}
                    >
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {highlightText(code.costHead, searchCostHead)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {highlightText(code.description, searchDescription)}
                      </TableCell>
                      <TableCell>{code.category}</TableCell>
                      <TableCell>
                        <Badge variant={getSheetBadgeVariant(code.sheet)}>
                          {code.sheet}
                        </Badge>
                      </TableCell>
                      <TableCell>{code.units}</TableCell>
                      <TableCell>{code.phase || '-'}</TableCell>
                      {!showSelector && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingCode(code);
                                setNewCode(code);
                                setShowAddModal(true);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteCode(code.costHead)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CostCodeLibraryManager;