import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trash2, 
  Plus, 
  Search, 
  Sparkles, 
  History, 
  Edit2, 
  Check, 
  X,
  AlertCircle,
  Package,
  Wrench,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCostCodes, useLaborCodes, useMaterialCodes } from '@/hooks/useCostCodes';

interface LaborPattern {
  id: string;
  system_name_pattern: string;
  labor_code: string;
  usage_count: number;
  confidence_score: number;
  last_used_at: string;
  created_at: string;
}

interface MaterialPattern {
  id: string;
  material_spec_pattern: string;
  item_type_pattern: string;
  material_code: string;
  usage_count: number;
  confidence_score: number;
  last_used_at: string;
  created_at: string;
}

export const PatternManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: laborCodes = [] } = useLaborCodes();
  const { data: materialCodes = [] } = useMaterialCodes();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('labor');
  
  // Edit state
  const [editingPattern, setEditingPattern] = useState<LaborPattern | MaterialPattern | null>(null);
  const [editCode, setEditCode] = useState('');
  
  // Add new pattern dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPattern, setNewPattern] = useState({
    type: 'labor' as 'labor' | 'material',
    systemPattern: '',
    materialSpec: '',
    itemType: '',
    code: ''
  });

  // Fetch labor patterns
  const { data: laborPatterns = [], isLoading: loadingLabor } = useQuery({
    queryKey: ['labor-patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mapping_patterns')
        .select('*')
        .order('usage_count', { ascending: false });
      if (error) throw error;
      return data as LaborPattern[];
    }
  });

  // Fetch material patterns
  const { data: materialPatterns = [], isLoading: loadingMaterial } = useQuery({
    queryKey: ['material-patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_mapping_patterns')
        .select('*')
        .order('usage_count', { ascending: false });
      if (error) throw error;
      return data as MaterialPattern[];
    }
  });

  // Delete labor pattern
  const deleteLaborPattern = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('mapping_patterns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-patterns'] });
      queryClient.invalidateQueries({ queryKey: ['mapping-patterns'] });
      toast.success('Labor pattern deleted');
    },
    onError: () => toast.error('Failed to delete pattern')
  });

  // Delete material pattern
  const deleteMaterialPattern = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('material_mapping_patterns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-patterns'] });
      queryClient.invalidateQueries({ queryKey: ['material-mapping-patterns'] });
      toast.success('Material pattern deleted');
    },
    onError: () => toast.error('Failed to delete pattern')
  });

  // Update labor pattern
  const updateLaborPattern = useMutation({
    mutationFn: async ({ id, labor_code }: { id: string; labor_code: string }) => {
      const { error } = await supabase
        .from('mapping_patterns')
        .update({ labor_code })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-patterns'] });
      queryClient.invalidateQueries({ queryKey: ['mapping-patterns'] });
      toast.success('Pattern updated');
      setEditingPattern(null);
    },
    onError: () => toast.error('Failed to update pattern')
  });

  // Update material pattern
  const updateMaterialPattern = useMutation({
    mutationFn: async ({ id, material_code }: { id: string; material_code: string }) => {
      const { error } = await supabase
        .from('material_mapping_patterns')
        .update({ material_code })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-patterns'] });
      queryClient.invalidateQueries({ queryKey: ['material-mapping-patterns'] });
      toast.success('Pattern updated');
      setEditingPattern(null);
    },
    onError: () => toast.error('Failed to update pattern')
  });

  // Add new labor pattern
  const addLaborPattern = useMutation({
    mutationFn: async ({ pattern, code }: { pattern: string; code: string }) => {
      const { error } = await supabase
        .from('mapping_patterns')
        .insert({
          system_name_pattern: pattern.toLowerCase().trim(),
          labor_code: code,
          usage_count: 1,
          confidence_score: 1.0
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-patterns'] });
      queryClient.invalidateQueries({ queryKey: ['mapping-patterns'] });
      toast.success('New labor pattern added');
      setShowAddDialog(false);
      setNewPattern({ type: 'labor', systemPattern: '', materialSpec: '', itemType: '', code: '' });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add pattern')
  });

  // Add new material pattern
  const addMaterialPattern = useMutation({
    mutationFn: async ({ materialSpec, itemType, code }: { materialSpec: string; itemType: string; code: string }) => {
      const { error } = await supabase
        .from('material_mapping_patterns')
        .insert({
          material_spec_pattern: materialSpec.toLowerCase().trim(),
          item_type_pattern: itemType.toLowerCase().trim(),
          material_code: code,
          usage_count: 1,
          confidence_score: 1.0
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-patterns'] });
      queryClient.invalidateQueries({ queryKey: ['material-mapping-patterns'] });
      toast.success('New material pattern added');
      setShowAddDialog(false);
      setNewPattern({ type: 'labor', systemPattern: '', materialSpec: '', itemType: '', code: '' });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add pattern')
  });


  // Filter patterns based on search
  const filteredLaborPatterns = laborPatterns.filter(p =>
    p.system_name_pattern.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.labor_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMaterialPatterns = materialPatterns.filter(p =>
    p.material_spec_pattern.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.item_type_pattern.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.material_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600 bg-green-50';
    if (score >= 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-orange-600 bg-orange-50';
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wrench className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{laborPatterns.length}</div>
              <div className="text-sm text-muted-foreground">Labor Patterns</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{materialPatterns.length}</div>
              <div className="text-sm text-muted-foreground">Material Patterns</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {laborPatterns.reduce((sum, p) => sum + p.usage_count, 0) + 
                 materialPatterns.reduce((sum, p) => sum + p.usage_count, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Uses</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">
                {Math.round(((laborPatterns.filter(p => p.confidence_score >= 0.8).length + 
                  materialPatterns.filter(p => p.confidence_score >= 0.8).length) / 
                  Math.max(1, laborPatterns.length + materialPatterns.length)) * 100)}%
              </div>
              <div className="text-sm text-muted-foreground">High Confidence</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patterns by keyword or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Pattern
        </Button>
      </div>

      {/* Tabs for Labor vs Material */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="labor" className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Labor Patterns ({laborPatterns.length})
          </TabsTrigger>
          <TabsTrigger value="material" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Material Patterns ({materialPatterns.length})
          </TabsTrigger>
        </TabsList>

        {/* Labor Patterns Tab */}
        <TabsContent value="labor" className="mt-4">
          <Card>
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold">Learned Labor Code Patterns</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                These patterns were learned from your mapping selections. They auto-suggest labor codes for new systems.
              </p>
            </div>
            
            {loadingLabor ? (
              <div className="p-8 text-center text-muted-foreground">Loading patterns...</div>
            ) : filteredLaborPatterns.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No labor patterns found</p>
                <p className="text-sm text-muted-foreground">Patterns are learned when you apply mappings in the Labor Mapping tab</p>
              </div>
            ) : (
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {filteredLaborPatterns.map((pattern) => (
                  <div key={pattern.id} className="p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <code className="text-sm font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            {pattern.system_name_pattern}
                          </code>
                          <span className="text-muted-foreground">→</span>
                          {editingPattern?.id === pattern.id ? (
                            <div className="flex items-center gap-2">
                              <Select value={editCode} onValueChange={setEditCode}>
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {laborCodes.map(code => (
                                    <SelectItem key={code.code} value={code.code}>
                                      {code.code} - {code.description}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateLaborPattern.mutate({ id: pattern.id, labor_code: editCode })}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingPattern(null)}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <Badge variant="default" className="bg-blue-600">
                              {pattern.labor_code}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Used {pattern.usage_count}x
                          </span>
                          <span className={`px-2 py-0.5 rounded ${getConfidenceColor(pattern.confidence_score)}`}>
                            {Math.round(pattern.confidence_score * 100)}% confidence
                          </span>
                          <span>Last used: {formatDate(pattern.last_used_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingPattern(pattern);
                            setEditCode(pattern.labor_code);
                          }}
                          disabled={editingPattern?.id === pattern.id}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete pattern "${pattern.system_name_pattern}"?`)) {
                              deleteLaborPattern.mutate(pattern.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Material Patterns Tab */}
        <TabsContent value="material" className="mt-4">
          <Card>
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold">Learned Material Code Patterns</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                These patterns were learned from your material code assignments. They match Material Spec + Item Type combinations.
              </p>
            </div>
            
            {loadingMaterial ? (
              <div className="p-8 text-center text-muted-foreground">Loading patterns...</div>
            ) : filteredMaterialPatterns.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No material patterns found</p>
                <p className="text-sm text-muted-foreground">Patterns are learned when you apply mappings in the Material Mapping tab</p>
              </div>
            ) : (
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {filteredMaterialPatterns.map((pattern) => (
                  <div key={pattern.id} className="p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Spec:</span>
                            <code className="text-sm font-mono bg-purple-50 text-purple-700 px-2 py-1 rounded">
                              {pattern.material_spec_pattern}
                            </code>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Type:</span>
                            <code className="text-sm font-mono bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                              {pattern.item_type_pattern}
                            </code>
                          </div>
                          <span className="text-muted-foreground">→</span>
                          {editingPattern?.id === pattern.id ? (
                            <div className="flex items-center gap-2">
                              <Select value={editCode} onValueChange={setEditCode}>
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {materialCodes.map(code => (
                                    <SelectItem key={code.code} value={code.code}>
                                      {code.code} - {code.description}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateMaterialPattern.mutate({ id: pattern.id, material_code: editCode })}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingPattern(null)}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                              {pattern.material_code}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Used {pattern.usage_count}x
                          </span>
                          <span className={`px-2 py-0.5 rounded ${getConfidenceColor(pattern.confidence_score)}`}>
                            {Math.round(pattern.confidence_score * 100)}% confidence
                          </span>
                          <span>Last used: {formatDate(pattern.last_used_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingPattern(pattern as any);
                            setEditCode(pattern.material_code);
                          }}
                          disabled={editingPattern?.id === pattern.id}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete pattern "${pattern.item_type_pattern}"?`)) {
                              deleteMaterialPattern.mutate(pattern.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Pattern Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Pattern</DialogTitle>
            <DialogDescription>
              Create a new pattern rule for automatic code suggestions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pattern Type</label>
              <Select 
                value={newPattern.type} 
                onValueChange={(v: 'labor' | 'material') => setNewPattern(p => ({ ...p, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="labor">Labor Code Pattern</SelectItem>
                  <SelectItem value="material">Material Code Pattern</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newPattern.type === 'labor' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">System Name Pattern</label>
                  <Input
                    placeholder="e.g., compressed air, storm drain, hot water"
                    value={newPattern.systemPattern}
                    onChange={(e) => setNewPattern(p => ({ ...p, systemPattern: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter a keyword or phrase that appears in system names
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Labor Code</label>
                  <Select 
                    value={newPattern.code} 
                    onValueChange={(v) => setNewPattern(p => ({ ...p, code: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select labor code..." />
                    </SelectTrigger>
                    <SelectContent>
                      {laborCodes.map(code => (
                        <SelectItem key={code.code} value={code.code}>
                          {code.code} - {code.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Material Spec Pattern</label>
                  <Input
                    placeholder="e.g., copper type l, stainless steel, cast iron"
                    value={newPattern.materialSpec}
                    onChange={(e) => setNewPattern(p => ({ ...p, materialSpec: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Item Type Pattern</label>
                  <Input
                    placeholder="e.g., pipe, fittings, valves, fixtures"
                    value={newPattern.itemType}
                    onChange={(e) => setNewPattern(p => ({ ...p, itemType: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Material Code</label>
                  <Select 
                    value={newPattern.code} 
                    onValueChange={(v) => setNewPattern(p => ({ ...p, code: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select material code..." />
                    </SelectTrigger>
                    <SelectContent>
                      {materialCodes.map(code => (
                        <SelectItem key={code.code} value={code.code}>
                          {code.code} - {code.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (newPattern.type === 'labor') {
                  if (!newPattern.systemPattern || !newPattern.code) {
                    toast.error('Please fill in all fields');
                    return;
                  }
                  addLaborPattern.mutate({ pattern: newPattern.systemPattern, code: newPattern.code });
                } else {
                  if (!newPattern.materialSpec || !newPattern.itemType || !newPattern.code) {
                    toast.error('Please fill in all fields');
                    return;
                  }
                  addMaterialPattern.mutate({ 
                    materialSpec: newPattern.materialSpec, 
                    itemType: newPattern.itemType, 
                    code: newPattern.code 
                  });
                }
              }}
            >
              Add Pattern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
