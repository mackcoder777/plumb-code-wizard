import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Building2, Wand2, Trash2, Plus } from 'lucide-react';
import {
  BuildingSectionMapping as BSM,
  DetectedBuilding,
  useBuildingSectionMappings,
  detectBuildingsFromDrawings,
} from '@/hooks/useBuildingSectionMappings';

interface Props {
  projectId: string;
  estimateItems: Array<{ drawing?: string }>;
  onMappingsChange?: () => void;
}

export const BuildingSectionMappingPanel: React.FC<Props> = ({
  projectId,
  estimateItems,
  onMappingsChange,
}) => {
  const { mappings, loading, upsertMapping, deleteMapping, autoPopulate, updateZonePattern } =
    useBuildingSectionMappings(projectId);

  const [detected, setDetected] = useState<DetectedBuilding[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [newBuildingId, setNewBuildingId] = useState('');
  const [newSectionCode, setNewSectionCode] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newZonePattern, setNewZonePattern] = useState('');

  useEffect(() => {
    if (estimateItems.length === 0) return;
    setDetected(detectBuildingsFromDrawings(estimateItems));
  }, [estimateItems]);

  const handleAutoPopulate = async () => {
    await autoPopulate(detected);
    onMappingsChange?.();
  };

  const handleSave = async (buildingId: string) => {
    const sectionCode = editValues[buildingId];
    if (!sectionCode?.trim()) return;
    await upsertMapping(buildingId, sectionCode.trim());
    setEditValues(prev => {
      const next = { ...prev };
      delete next[buildingId];
      return next;
    });
    onMappingsChange?.();
  };

  const handleDelete = async (m: BSM) => {
    await deleteMapping(m.id);
    onMappingsChange?.();
  };

  const handleAddNew = async () => {
    if (!newBuildingId.trim() || !newSectionCode.trim()) return;
    await upsertMapping(
      newBuildingId.trim().toUpperCase(),
      newSectionCode.trim().toUpperCase(),
      newDescription.trim()
    );
    setNewBuildingId('');
    setNewSectionCode('');
    setNewDescription('');
    onMappingsChange?.();
  };

  const unmappedBuildings = detected.filter(
    d => !mappings.find(m => m.building_identifier === d.building_identifier)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Building → Section Code
              <Badge variant="secondary" className="ml-2">{mappings.length} mapped</Badge>
            </CardTitle>
            <CardDescription>
              When floor values like "Roof" or "Crawl Space" don't contain a building
              identifier, the system falls back to the drawing name to determine the
              section code.
            </CardDescription>
          </div>
          {unmappedBuildings.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleAutoPopulate}>
              <Wand2 className="h-4 w-4 mr-1" />
              Auto-detect ({unmappedBuildings.length} new)
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auto-detected but unmapped */}
        {unmappedBuildings.length > 0 && (
          <div className="p-3 bg-muted/50 rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground mb-2">
              {unmappedBuildings.length} building(s) detected from drawing names — not yet mapped:
            </p>
            <div className="flex flex-wrap gap-2">
              {unmappedBuildings.map(d => (
                <div key={d.building_identifier} className="flex items-center gap-1 text-sm">
                  <Badge variant="outline">{d.building_identifier}</Badge>
                  <span className="text-muted-foreground">→ suggested:</span>
                  <span className="font-mono font-medium">{d.suggested_section}</span>
                  <span className="text-muted-foreground text-xs">({d.item_count} items)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing mappings */}
        {mappings.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Building</TableHead>
                <TableHead>Section Code</TableHead>
                <TableHead>Zone Pattern</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map(m => {
                const det = detected.find(d => d.building_identifier === m.building_identifier);
                const isEditing = editValues[m.building_identifier] !== undefined;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono font-medium">{m.building_identifier}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editValues[m.building_identifier] || ''}
                          className="w-20 h-8 font-mono"
                          onChange={e =>
                            setEditValues(prev => ({
                              ...prev,
                              [m.building_identifier]: e.target.value.toUpperCase(),
                            }))
                          }
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSave(m.building_identifier);
                            if (e.key === 'Escape')
                              setEditValues(prev => {
                                const next = { ...prev };
                                delete next[m.building_identifier];
                                return next;
                              });
                          }}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="font-mono cursor-pointer hover:text-primary"
                          onClick={() =>
                            setEditValues(prev => ({
                              ...prev,
                              [m.building_identifier]: m.section_code,
                            }))
                          }
                        >
                          {m.section_code}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="e.g. MODULAR"
                        defaultValue={m.zone_pattern || ''}
                        className="w-32 h-8 text-xs font-mono"
                        title="Items on standalone floors whose zone contains this keyword resolve to this building section"
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (m.zone_pattern || '')) {
                            updateZonePattern(m.id, val);
                            onMappingsChange?.();
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.description}</TableCell>
                    <TableCell>{det ? `${det.item_count}` : '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isEditing && (
                          <Button size="sm" variant="outline" onClick={() => handleSave(m.building_identifier)}>
                            Save
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(m)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Add new row */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            placeholder="Building ID"
            value={newBuildingId}
            className="w-24 font-mono"
            onChange={e => setNewBuildingId(e.target.value.toUpperCase())}
          />
          <span className="text-muted-foreground">→</span>
          <Input
            placeholder="Section"
            value={newSectionCode}
            className="w-20 font-mono"
            onChange={e => setNewSectionCode(e.target.value.toUpperCase())}
          />
          <Input
            placeholder="Description (optional)"
            value={newDescription}
            className="flex-1"
            onChange={e => setNewDescription(e.target.value)}
          />
          <Button size="sm" onClick={handleAddNew} disabled={!newBuildingId.trim() || !newSectionCode.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
