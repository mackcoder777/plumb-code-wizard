import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2,
  Library,
  Download,
  Filter
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { 
  useCostCodes, 
  useAddCostCode, 
  useUpdateCostCode, 
  useDeleteCostCode,
  CostCode 
} from '@/hooks/useCostCodes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CodeFormData {
  code: string;
  description: string;
  category: 'L' | 'M';
  subcategory?: string;
  units?: string;
}

const INITIAL_FORM: CodeFormData = {
  code: '',
  description: '',
  category: 'L',
  subcategory: '',
  units: '',
};

export const AdminCostCodeManager: React.FC = () => {
  const { data: costCodes = [], isLoading, error } = useCostCodes();
  const addCostCode = useAddCostCode();
  const updateCostCode = useUpdateCostCode();
  const deleteCostCode = useDeleteCostCode();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'L' | 'M'>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<CostCode | null>(null);
  const [formData, setFormData] = useState<CodeFormData>(INITIAL_FORM);

  // Statistics
  const stats = useMemo(() => {
    const laborCount = costCodes.filter(c => c.category === 'L').length;
    const materialCount = costCodes.filter(c => c.category === 'M').length;
    return {
      total: costCodes.length,
      labor: laborCount,
      material: materialCount,
    };
  }, [costCodes]);

  // Filtered codes
  const filteredCodes = useMemo(() => {
    return costCodes.filter(code => {
      const matchesSearch = 
        code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || code.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [costCodes, searchTerm, categoryFilter]);

  const handleAddCode = async () => {
    if (!formData.code.trim() || !formData.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Code and Description are required",
        variant: "destructive",
      });
      return;
    }

    try {
      await addCostCode.mutateAsync({
        code: formData.code.toUpperCase().trim(),
        description: formData.description.toUpperCase().trim(),
        category: formData.category,
        subcategory: formData.subcategory?.trim() || undefined,
        units: formData.units?.trim() || undefined,
      });

      toast({
        title: "Success",
        description: `Cost code ${formData.code} added successfully`,
      });
      setIsAddDialogOpen(false);
      setFormData(INITIAL_FORM);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to add cost code",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCode = async () => {
    if (!editingCode || !formData.code.trim() || !formData.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Code and Description are required",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateCostCode.mutateAsync({
        id: editingCode.id,
        code: formData.code.toUpperCase().trim(),
        description: formData.description.toUpperCase().trim(),
        category: formData.category,
        subcategory: formData.subcategory?.trim() || undefined,
        units: formData.units?.trim() || undefined,
      });

      toast({
        title: "Success",
        description: `Cost code ${formData.code} updated successfully`,
      });
      setEditingCode(null);
      setFormData(INITIAL_FORM);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update cost code",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCode = async (code: CostCode) => {
    try {
      await deleteCostCode.mutateAsync(code.id);
      toast({
        title: "Success",
        description: `Cost code ${code.code} deleted successfully`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete cost code",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (code: CostCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description,
      category: code.category,
      subcategory: code.subcategory || '',
      units: code.units || '',
    });
  };

  const exportCodes = () => {
    const csv = ['Code,Description,Category,Subcategory,Units'];
    filteredCodes.forEach(code => {
      csv.push(`"${code.code}","${code.description}","${code.category === 'L' ? 'Labor' : 'Material'}","${code.subcategory || ''}","${code.units || ''}"`);
    });

    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost_codes_${categoryFilter === 'all' ? 'all' : categoryFilter === 'L' ? 'labor' : 'material'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const CodeFormDialog = ({ 
    isOpen, 
    onClose, 
    onSubmit, 
    title, 
    submitLabel,
    isSubmitting 
  }: { 
    isOpen: boolean; 
    onClose: () => void; 
    onSubmit: () => void; 
    title: string;
    submitLabel: string;
    isSubmitting: boolean;
  }) => (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {editingCode ? 'Update the cost code details below.' : 'Enter the details for the new cost code.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                placeholder="e.g., PIPE, 9511"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value: 'L' | 'M') => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Labor (L)</SelectItem>
                  <SelectItem value="M">Material (M)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              placeholder="e.g., Cast Iron Pipe & Fittings"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subcategory">Subcategory</Label>
              <Input
                id="subcategory"
                placeholder="e.g., Plumbing"
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="units">Units</Label>
              <Input
                id="units"
                placeholder="e.g., HRS, EA, LF"
                value={formData.units}
                onChange={(e) => setFormData({ ...formData, units: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-6">
          <p className="text-destructive">Error loading cost codes: {(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Library className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Cost Code Library</CardTitle>
                <CardDescription>View, add, edit, and delete cost codes</CardDescription>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-center px-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center px-4 border-l">
                <div className="text-2xl font-bold text-blue-600">{stats.labor}</div>
                <div className="text-xs text-muted-foreground">Labor</div>
              </div>
              <div className="text-center px-4 border-l">
                <div className="text-2xl font-bold text-green-600">{stats.material}</div>
                <div className="text-xs text-muted-foreground">Material</div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-3 items-center flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={(v: 'all' | 'L' | 'M') => setCategoryFilter(v)}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="L">Labor Only</SelectItem>
                  <SelectItem value="M">Material Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCodes}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={() => { setFormData(INITIAL_FORM); setIsAddDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Code
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground mt-3">
            Showing {filteredCodes.length} of {costCodes.length} codes
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-32">Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-28">Category</TableHead>
                  <TableHead className="w-32">Subcategory</TableHead>
                  <TableHead className="w-24">Units</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchTerm || categoryFilter !== 'all' 
                        ? 'No codes match your filters' 
                        : 'No cost codes in the library'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCodes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-semibold">{code.code}</TableCell>
                      <TableCell>{code.description}</TableCell>
                      <TableCell>
                        <Badge variant={code.category === 'L' ? 'default' : 'secondary'}>
                          {code.category === 'L' ? 'Labor' : 'Material'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{code.subcategory || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{code.units || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(code)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Cost Code</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete <strong>{code.code}</strong>? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCode(code)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <CodeFormDialog
        isOpen={isAddDialogOpen}
        onClose={() => { setIsAddDialogOpen(false); setFormData(INITIAL_FORM); }}
        onSubmit={handleAddCode}
        title="Add New Cost Code"
        submitLabel="Add Code"
        isSubmitting={addCostCode.isPending}
      />

      {/* Edit Dialog */}
      <CodeFormDialog
        isOpen={!!editingCode}
        onClose={() => { setEditingCode(null); setFormData(INITIAL_FORM); }}
        onSubmit={handleUpdateCode}
        title="Edit Cost Code"
        submitLabel="Save Changes"
        isSubmitting={updateCostCode.isPending}
      />
    </div>
  );
};
