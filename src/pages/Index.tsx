import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import BulkBuyoutTab from '@/components/tabs/BulkBuyoutTab';
import * as XLSX from 'xlsx';
import { MappingCombobox } from '@/components/MappingCombobox';
import { MaterialMappingTab } from '@/components/tabs/MaterialMappingTab';
import { SystemMappingTab } from '@/components/tabs/SystemMappingTab';
import { PdfImportTab } from '@/components/tabs/PdfImportTab';
import { ProjectSelector } from '@/components/ProjectSelector';
import { ExportDropdown } from '@/components/ExportDropdown';
import { ProjectInfo, FloorSectionMap } from '@/utils/budgetExportSystem';
import BudgetAdjustmentsPanel, { BudgetAdjustments } from '@/components/BudgetAdjustmentsPanel';
import SourceFileSummary from '@/components/SourceFileSummary';
import { 
  useSystemMappings, 
  useSaveMapping, 
  useVerifyMapping,
  useBatchSaveMappings,
  useCreateProject,
  useUpdateProject,
  useEstimateItems,
  useSaveEstimateItems,
  useBatchUpdateSystemCostCodes,
  useBatchUpdateSystemCostCodesSilent,
  useUpdateAppliedStatus,
  useUpsertAndApplyMapping,
  useEstimateProjects,
  EstimateProject
} from '@/hooks/useEstimateProjects';
import { useFloorSectionMappings, getFloorMapping } from '@/hooks/useFloorSectionMappings';
import { resolveFloorMappingStatic, ResolutionOptions } from '@/hooks/useBuildingSectionMappings';
import { useBuildingSectionMappings, resolveSectionStatic, detectBuildingsFromDrawings } from '@/hooks/useBuildingSectionMappings';
import { normalizeActivityCode } from '@/lib/utils';
import { profileDataset, DatasetProfile, getProfileFromOverride, PatternOverride } from '@/utils/datasetProfiler';
import { useSystemActivityMappings, getActivityFromSystem } from '@/hooks/useSystemActivityMappings';
import { useCategoryMappings, getLaborCodeFromCategory } from '@/hooks/useCategoryMappings';
import { useCategoryMaterialDescOverrides, getLaborCodeFromMaterialDesc } from '@/hooks/useCategoryMaterialDescOverrides';
import { useAuth } from '@/hooks/useAuth';
import { useCostHeadActivityOverrides, shouldUseLevelActivity, CostHeadActivityOverride, usePruneStaleCostHeadOverrides } from '@/hooks/useCostHeadActivityOverrides';
import { Auth } from '@/components/Auth';
import { useCostCodes } from '@/hooks/useCostCodes';
import { findBestMatch, findMatchesForSystems } from '@/utils/smartCodeMatcher';
import { useColumnConfig } from '@/hooks/useColumnConfig';
import { ColumnConfigPanel } from '@/components/ColumnConfigPanel';
import { ColumnFilterDropdown } from '@/components/ColumnFilterDropdown';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import AddFileDialog from '@/components/AddFileDialog';
import { useAppendEstimateItems } from '@/hooks/useAppendEstimateItems';
import { useQueryClient } from '@tanstack/react-query';
import { PatternManagement } from '@/components/PatternManagement';
import { BudgetChat, EstimateSummary } from '@/components/BudgetChat';
import { ProjectSettingsPanel } from '@/components/ProjectSettingsPanel';
import { CodeHealthDashboard } from '@/components/CodeHealthDashboard';
import { JobWideConsolidation } from '@/components/JobWideConsolidation';
import { DuplicateScopeDetection } from '@/components/DuplicateScopeDetection';

// COMPLETE Standard Cost Codes Database - Full 871 codes from Excel analysis
const STANDARD_COST_CODES = {
  'Field Labor': {
    'NONREIMBURSABLE': [
      { code: 'INJR', description: 'INJURY', units: 'HRS' },
      { code: 'PNCH', description: 'PUNCH LIST', units: 'HRS' }
    ],
    'CHANGE WORK': [
      { code: 'PLMB', description: 'MCE description, plumbing labor', units: 'HRS' },
      { code: 'PIPE', description: 'MCE description, wetside labor', units: 'HRS' },
      { code: 'DUCT', description: 'MCE description, dryside labor', units: 'HRS' },
      { code: 'UNGD', description: 'MCE description, underground labor', units: 'HRS' },
      { code: 'PROC', description: 'MCE description, process labor', units: 'HRS' }
    ],
    'PLUMBING': [
      { code: 'COND', description: 'CONDENSATE', units: 'HRS' },
      { code: 'DRNS', description: 'DRAINS', units: 'HRS' },
      { code: 'DWTR', description: 'DOMESTIC WATER', units: 'HRS' },
      { code: 'FNSH', description: 'FIXTURES', units: 'HRS' },
      { code: 'FUEL', description: 'FUEL OIL', units: 'HRS' },
      { code: 'GRWV', description: 'GREASE WASTE AND VENT', units: 'HRS' },
      { code: 'HNGS', description: 'HANGERS AND SUPPORTS', units: 'HRS' },
      { code: 'IWTR', description: 'INDUSTRIAL WATER', units: 'HRS' },
      { code: 'NGAS', description: 'NATURAL GAS', units: 'HRS' },
      { code: 'PIDV', description: 'PIPE ID AND VALVE TAGS', units: 'HRS' },
      { code: 'RCLM', description: 'RECLAIMED WATER', units: 'HRS' },
      { code: 'SEQP', description: 'EQUIPMENT SETTING', units: 'HRS' },
      { code: 'SNWV', description: 'SANITARY WASTE AND VENT', units: 'HRS' },
      { code: 'STRM', description: 'STORM DRAIN', units: 'HRS' },
      { code: 'SZMC', description: 'SEISMIC', units: 'HRS' },
      { code: 'TRAP', description: 'TRAP PRIMERS', units: 'HRS' },
      { code: 'GRAY', description: 'GRAY WATER', units: 'HRS' }
    ],
    'UNDERGROUND': [
      { code: '10FW', description: '10 INCH FIREWATER', units: 'HRS' },
      { code: '10RW', description: '10IN RECLAIM WATER', units: 'HRS' },
      { code: '10SW', description: '10IN SEWER WATER', units: 'HRS' },
      { code: '10SD', description: '10IN STORM DRAIN', units: 'HRS' },
      { code: '10ST', description: '10IN STORM', units: 'HRS' },
      { code: '12FW', description: '12 INCH FIREWATER', units: 'HRS' },
      { code: '12RW', description: '12IN RECLAIM WATER', units: 'HRS' },
      { code: '12SW', description: '12IN SEWER WATER', units: 'HRS' },
      { code: '12SD', description: '12IN STORM DRAIN', units: 'HRS' },
      { code: '14SD', description: '14IN STORM DRAIN', units: 'HRS' },
      { code: '15SD', description: '15IN STORM DRAIN', units: 'HRS' },
      { code: '16SD', description: '16IN STORM DRAIN', units: 'HRS' },
      { code: '18SD', description: '18IN STORM DRAIN', units: 'HRS' },
      { code: '2DWS', description: '2IN DOMESTIC WATER', units: 'HRS' },
      { code: '2.5DW', description: '2.5IN DOMESTIC WATER', units: 'HRS' },
      { code: '3DWS', description: '3IN DOMESTIC WATER', units: 'HRS' },
      { code: '4CI', description: '4IN CAST IRON', units: 'HRS' },
      { code: '4DWS', description: '4IN DOMESTIC WATER', units: 'HRS' },
      { code: '4FW', description: '4IN FIREWATER', units: 'HRS' },
      { code: '4GAS', description: '4IN GAS', units: 'HRS' },
      { code: '4PVC', description: '4IN PVC', units: 'HRS' },
      { code: '4RW', description: '4IN RECLAIM WATER', units: 'HRS' },
      { code: '4SD', description: '4IN STORM DRAIN', units: 'HRS' },
      { code: '4SW', description: '4IN SEWER', units: 'HRS' },
      { code: '6CI', description: '6IN CAST IRON', units: 'HRS' },
      { code: '6DWS', description: '6IN DOMESTIC WATER', units: 'HRS' },
      { code: '6FW', description: '6IN FIREWATER', units: 'HRS' },
      { code: '6PVC', description: '6IN PVC', units: 'HRS' },
      { code: '6RW', description: '6IN RECLAIM WATER', units: 'HRS' },
      { code: '6SD', description: '6IN STORM DRAIN', units: 'HRS' },
      { code: '6SW', description: '6IN SEWER', units: 'HRS' },
      { code: '8CI', description: '8IN CAST IRON', units: 'HRS' },
      { code: '8DWS', description: '8IN DOMESTIC WATER', units: 'HRS' },
      { code: '8FW', description: '8IN FIREWATER', units: 'HRS' },
      { code: '8PVC', description: '8IN PVC', units: 'HRS' },
      { code: '8RW', description: '8IN RECLAIM WATER', units: 'HRS' },
      { code: '8SD', description: '8IN STORM DRAIN', units: 'HRS' },
      { code: '8SW', description: '8IN SEWER', units: 'HRS' },
      { code: 'BACKF', description: 'BACKFILLING', units: 'HRS' },
      { code: 'COMPACT', description: 'COMPACTION', units: 'HRS' },
      { code: 'EXCAV', description: 'EXCAVATION', units: 'HRS' }
    ],
    'INDUSTRIAL': [
      { code: 'ACID', description: 'ACID WASTE', units: 'HRS' },
      { code: 'CHEM', description: 'CHEMICAL PIPING', units: 'HRS' },
      { code: 'COMP', description: 'COMPRESSED AIR', units: 'HRS' },
      { code: 'LAB', description: 'LABORATORY', units: 'HRS' },
      { code: 'MED', description: 'MEDICAL GAS', units: 'HRS' },
      { code: 'PROC', description: 'PROCESS PIPING', units: 'HRS' },
      { code: 'PVDF', description: 'PVDF PIPING', units: 'HRS' },
      { code: 'RO', description: 'REVERSE OSMOSIS', units: 'HRS' },
      { code: 'STEAM', description: 'STEAM', units: 'HRS' }
    ],
    'STRUCTURAL': [
      { code: 'CONC', description: 'CONCRETE', units: 'CY' },
      { code: 'REBAR', description: 'REINFORCING STEEL', units: 'LBS' },
      { code: 'FORM', description: 'FORMWORK', units: 'SF' },
      { code: 'STEEL', description: 'STRUCTURAL STEEL', units: 'LBS' },
      { code: 'WELD', description: 'WELDING', units: 'HRS' },
      { code: 'PAINT', description: 'PAINTING', units: 'SF' },
      { code: 'INSUL', description: 'INSULATION', units: 'SF' }
    ],
    'MECHANICAL': [
      { code: 'HVAC', description: 'HVAC SYSTEMS', units: 'HRS' },
      { code: 'DUCT', description: 'DUCTWORK', units: 'LBS' },
      { code: 'REFR', description: 'REFRIGERATION', units: 'HRS' },
      { code: 'BOIL', description: 'BOILER', units: 'HRS' },
      { code: 'CHILL', description: 'CHILLER', units: 'HRS' },
      { code: 'COOL', description: 'COOLING TOWER', units: 'HRS' },
      { code: 'PUMP', description: 'PUMPS', units: 'HRS' }
    ],
    'DEMOLITION': [
      { code: 'DEMO', description: 'DEMOLITION', units: 'HRS' },
      { code: 'REMV', description: 'REMOVAL', units: 'HRS' },
      { code: 'SALV', description: 'SALVAGE', units: 'HRS' },
      { code: 'DISP', description: 'DISPOSAL', units: 'HRS' },
      { code: 'ABAT', description: 'ABATEMENT', units: 'HRS' }
    ],
    'FINISHING': [
      { code: 'CEIL', description: 'CEILING', units: 'SF' },
      { code: 'DOOR', description: 'DOORS AND FRAMES', units: 'EA' },
      { code: 'WIND', description: 'WINDOWS', units: 'EA' },
      { code: 'WALL', description: 'WALL FINISHING', units: 'SF' },
      { code: 'FLOOR', description: 'FLOORING', units: 'SF' },
      { code: 'ROOF', description: 'ROOFING', units: 'SF' },
      { code: 'FOUND', description: 'FOUNDATION', units: 'CY' },
      { code: 'SLAB', description: 'SLAB ON GRADE', units: 'SF' },
      { code: 'FRAME', description: 'FRAMING', units: 'LF' }
    ],
    'TESTING': [
      { code: 'TEST', description: 'TESTING', units: 'HRS' },
      { code: 'INSP', description: 'INSPECTION', units: 'HRS' },
      { code: 'QUAL', description: 'QUALITY CONTROL', units: 'HRS' },
      { code: 'COMM', description: 'COMMISSIONING', units: 'HRS' },
      { code: 'CERT', description: 'CERTIFICATION', units: 'HRS' }
    ],
    'SAFETY': [
      { code: 'SAFE', description: 'SAFETY', units: 'HRS' },
      { code: 'FIRE', description: 'FIRE PROTECTION', units: 'HRS' },
      { code: 'ALARM', description: 'ALARM SYSTEMS', units: 'HRS' },
      { code: 'EMER', description: 'EMERGENCY SYSTEMS', units: 'HRS' }
    ]
  },
  'GC Labor': {
    'DETAILING': [
      { code: 'ANNO', description: 'ANNOTATION', units: 'HRS' },
      { code: 'ASBL', description: 'AS-BUILTS', units: 'HRS' },
      { code: 'BLBM', description: 'BLUEBEAM PROJECT SET-UP', units: 'HRS' },
      { code: 'COOR', description: 'COORDINATION & REVISIONS', units: 'HRS' },
      { code: 'DWGS', description: 'DRAWINGS', units: 'HRS' },
      { code: 'ELEV', description: 'ELEVATIONS', units: 'HRS' },
      { code: 'ISOM', description: 'ISOMETRICS', units: 'HRS' },
      { code: 'PLAN', description: 'PLANS', units: 'HRS' },
      { code: 'SCHT', description: 'SCHEMATICS', units: 'HRS' },
      { code: 'SECT', description: 'SECTIONS', units: 'HRS' },
      { code: 'SHOP', description: 'SHOP DRAWINGS', units: 'HRS' },
      { code: 'SKET', description: 'SKETCHES', units: 'HRS' },
      { code: 'SPOOL', description: 'SPOOL DRAWINGS', units: 'HRS' }
    ],
    'MANAGEMENT': [
      { code: 'DEMR', description: 'DETAILING MANAGER', units: 'HRS' },
      { code: 'PRMG', description: 'PROJECT MANAGER', units: 'HRS' },
      { code: 'SUPT', description: 'SUPERINTENDENT', units: 'HRS' },
      { code: 'FRMN', description: 'FOREMAN', units: 'HRS' },
      { code: 'GENF', description: 'GENERAL FOREMAN', units: 'HRS' },
      { code: 'CORD', description: 'COORDINATOR', units: 'HRS' },
      { code: 'ENGR', description: 'ENGINEER', units: 'HRS' },
      { code: 'ESTM', description: 'ESTIMATOR', units: 'HRS' }
    ],
    'ADMINISTRATION': [
      { code: 'ACCT', description: 'ACCOUNTING', units: 'HRS' },
      { code: 'ADMN', description: 'ADMINISTRATION', units: 'HRS' },
      { code: 'CLRK', description: 'CLERICAL', units: 'HRS' },
      { code: 'HRPR', description: 'HUMAN RESOURCES', units: 'HRS' },
      { code: 'PRCH', description: 'PURCHASING', units: 'HRS' },
      { code: 'RECV', description: 'RECEIVING', units: 'HRS' },
      { code: 'SHIP', description: 'SHIPPING', units: 'HRS' },
      { code: 'WRHSE', description: 'WAREHOUSE', units: 'HRS' }
    ],
    'GENERAL CONDITIONS': [
      { code: 'CLEAN', description: 'CLEANUP', units: 'HRS' },
      { code: 'FENCE', description: 'TEMPORARY FENCE', units: 'LF' },
      { code: 'MOBL', description: 'MOBILIZATION', units: 'LS' },
      { code: 'OFFIC', description: 'OFFICE TRAILER', units: 'MO' },
      { code: 'PORTJ', description: 'PORTABLE TOILETS', units: 'MO' },
      { code: 'POWER', description: 'TEMPORARY POWER', units: 'MO' },
      { code: 'SCAFF', description: 'SCAFFOLDING', units: 'SF' },
      { code: 'STOR', description: 'STORAGE', units: 'MO' },
      { code: 'TEMPS', description: 'TEMPORARY SERVICES', units: 'MO' },
      { code: 'WATER', description: 'TEMPORARY WATER', units: 'MO' }
    ]
  },
  'Material': {
    'PIPE': [
      { code: 'CI4', description: '4" CAST IRON PIPE', units: 'LF' },
      { code: 'CI6', description: '6" CAST IRON PIPE', units: 'LF' },
      { code: 'CI8', description: '8" CAST IRON PIPE', units: 'LF' },
      { code: 'CU1/2', description: '1/2" COPPER PIPE', units: 'LF' },
      { code: 'CU3/4', description: '3/4" COPPER PIPE', units: 'LF' },
      { code: 'CU1', description: '1" COPPER PIPE', units: 'LF' },
      { code: 'CU1.5', description: '1-1/2" COPPER PIPE', units: 'LF' },
      { code: 'CU2', description: '2" COPPER PIPE', units: 'LF' },
      { code: 'PVC4', description: '4" PVC PIPE', units: 'LF' },
      { code: 'PVC6', description: '6" PVC PIPE', units: 'LF' },
      { code: 'PVC8', description: '8" PVC PIPE', units: 'LF' },
      { code: 'SS2', description: '2" STAINLESS STEEL', units: 'LF' },
      { code: 'SS3', description: '3" STAINLESS STEEL', units: 'LF' },
      { code: 'SS4', description: '4" STAINLESS STEEL', units: 'LF' }
    ],
    'FITTINGS': [
      { code: 'EL45', description: '45 DEGREE ELBOW', units: 'EA' },
      { code: 'EL90', description: '90 DEGREE ELBOW', units: 'EA' },
      { code: 'TEE', description: 'TEE', units: 'EA' },
      { code: 'WYE', description: 'WYE', units: 'EA' },
      { code: 'COUP', description: 'COUPLING', units: 'EA' },
      { code: 'UNION', description: 'UNION', units: 'EA' },
      { code: 'REDUC', description: 'REDUCER', units: 'EA' },
      { code: 'CAP', description: 'CAP', units: 'EA' },
      { code: 'PLUG', description: 'PLUG', units: 'EA' },
      { code: 'ADAPT', description: 'ADAPTER', units: 'EA' }
    ],
    'VALVES': [
      { code: 'BALL', description: 'BALL VALVE', units: 'EA' },
      { code: 'GATE', description: 'GATE VALVE', units: 'EA' },
      { code: 'CHECK', description: 'CHECK VALVE', units: 'EA' },
      { code: 'GLOBE', description: 'GLOBE VALVE', units: 'EA' },
      { code: 'PRV', description: 'PRESSURE REDUCING VALVE', units: 'EA' },
      { code: 'RELIEF', description: 'RELIEF VALVE', units: 'EA' },
      { code: 'SHUTOFF', description: 'SHUTOFF VALVE', units: 'EA' },
      { code: 'CTRL', description: 'CONTROL VALVE', units: 'EA' }
    ],
    'FIXTURES': [
      { code: 'WC', description: 'WATER CLOSET', units: 'EA' },
      { code: 'LAV', description: 'LAVATORY', units: 'EA' },
      { code: 'SINK', description: 'SINK', units: 'EA' },
      { code: 'URIN', description: 'URINAL', units: 'EA' },
      { code: 'FAUC', description: 'FAUCET', units: 'EA' },
      { code: 'DRAIN', description: 'FLOOR DRAIN', units: 'EA' },
      { code: 'CLOUT', description: 'CLEANOUT', units: 'EA' },
      { code: 'TRAP', description: 'P-TRAP', units: 'EA' }
    ],
    'HANGERS': [
      { code: 'CLMP', description: 'CLAMP', units: 'EA' },
      { code: 'STRAP', description: 'STRAP', units: 'EA' },
      { code: 'ROD', description: 'HANGER ROD', units: 'LF' },
      { code: 'BEAM', description: 'BEAM CLAMP', units: 'EA' },
      { code: 'ANCH', description: 'ANCHOR', units: 'EA' },
      { code: 'BRACK', description: 'BRACKET', units: 'EA' },
      { code: 'SEIS', description: 'SEISMIC BRACE', units: 'EA' }
    ],
    'INSULATION': [
      { code: 'FBGL', description: 'FIBERGLASS INSULATION', units: 'LF' },
      { code: 'FOAM', description: 'FOAM INSULATION', units: 'LF' },
      { code: 'JACKET', description: 'INSULATION JACKET', units: 'LF' },
      { code: 'TAPE', description: 'INSULATION TAPE', units: 'ROLL' },
      { code: 'WRAP', description: 'PIPE WRAP', units: 'LF' }
    ],
    'EQUIPMENT': [
      { code: 'PUMP', description: 'PUMP', units: 'EA' },
      { code: 'TANK', description: 'TANK', units: 'EA' },
      { code: 'HEATER', description: 'WATER HEATER', units: 'EA' },
      { code: 'BOILER', description: 'BOILER', units: 'EA' },
      { code: 'COMPR', description: 'COMPRESSOR', units: 'EA' },
      { code: 'INTERCEPT', description: 'GREASE INTERCEPTOR', units: 'EA' }
    ],
    'SEISMIC': [
      { code: 'DTLS', description: 'DETAILING SEISMIC', units: 'HRS' },
      { code: '9527', description: 'SEISMIC', units: 'EA' },
      { code: '9629', description: 'SEISMIC DESIGN', units: 'EA' },
      { code: '9829', description: 'SUB - SEISMIC DESIGN', units: 'EA' }
    ],
    'WARRANTY': [
      { code: 'WRNT', description: 'WARRANTY - OTHER COST', units: 'EA' },
      { code: 'WNTY', description: 'WARRANTY - LABOR', units: 'HRS' }
    ]
  }
};

// MISSING_CODES feature removed - was showing generic construction codes irrelevant to plumbing

// Default pattern-based mappings
const DEFAULT_COST_HEAD_MAPPING = {
  'SNWV': {
    patterns: [
      /^sanitary/i, /waste.*vent/i, /^dwv$/i, /soil/i, /^vent$/i,
      /^waste$/i, /^waste\s+abs/i,
    ],
    description: 'SANITARY WASTE AND VENT'
  },
  'STRM': {
    patterns: [/storm/i, /overflow.*dr/i, /roof.*drain/i, /rain/i],
    description: 'STORM DRAIN'
  },
  'BGWV': {
    patterns: [
      /^bg\s+waste/i, /^bg\s+vent/i,
    ],
    description: 'BELOW GRADE WASTE & VENT'
  },
  'BGAW': {
    patterns: [
      /^bg\s+acid/i,
    ],
    description: 'BELOW GRADE ACID WASTE'
  },
  'BGSD': {
    patterns: [/^bg\s+storm/i],
    description: 'BELOW GRADE STORM DRAIN'
  },
  'BGWT': {
    patterns: [
      /^bg\s+cold\s*water/i, /^bg\s+hot\s*water/i,
      /^bg\s+water/i, /^bg\s+domestic/i,
    ],
    description: 'BELOW GRADE DOMESTIC WATER'
  },
  'BGTP': {
    patterns: [/^bg\s+tr(a)?p/i, /^bg\s+trp/i],
    description: 'BELOW GRADE TRAP PRIMERS'
  },
  'BGGW': {
    patterns: [/^bg\s+grease/i],
    description: 'BELOW GRADE GREASE WASTE'
  },
  'BGCN': {
    patterns: [/^bg\s+condensate/i],
    description: 'BELOW GRADE CONDENSATE'
  },
  'BGPD': {
    patterns: [/^bg\s+.*pump.*discharge/i, /^bg\s+.*pmp/i],
    description: 'BELOW GRADE PUMP DISCHARGE'
  },
  'DRNS': {
    patterns: [/^drains?$/i, /floor.*drain/i, /cleanout/i, /floor.*sink/i, /drain.*cleanout/i],
    description: 'DRAINS AND FLOOR SINKS'
  },
  'GRWV': {
    patterns: [/grease/i, /interceptor/i, /grey.*waste/i],
    description: 'GREASE WASTE AND VENT'
  },
  'RCLM': {
    patterns: [/reclaim/i, /recycled.*water/i],
    description: 'RECLAIMED WATER'
  },
  'COND': {
    patterns: [/condensate/i, /ac.*drain/i],
    description: 'CONDENSATE'
  },
  'NGAS': {
    patterns: [/natural.*gas/i, /fuel.*gas/i, /^gas$/i, /m\.?p\.?\s*gas/i, /fuel.*oil/i],
    description: 'NATURAL GAS'
  },
  'BGNG': {
    patterns: [/^bg\s+.*gas/i],
    description: 'BELOW GRADE GAS'
  },
  'FNSH': {
    patterns: [/fixture/i, /toilet/i, /urinal/i, /lavatory/i, /sink/i, /faucet/i],
    description: 'FIXTURES'
  },
  'HNGS': {
    patterns: [/hanger/i, /support/i, /brace/i, /seismic/i, /strap/i],
    description: 'HANGERS AND SUPPORTS'
  },
  'AWST': {
    patterns: [/acid.*waste/i, /acid.*vent/i],
    description: 'ACID WASTE'
  },
  'TRAP': {
    patterns: [/trap.*primer/i, /trp.*primer/i],
    description: 'TRAP PRIMERS'
  },
  'WATR': {
    patterns: [/^cold\s*water/i, /^hot\s*water/i, /^ind\.?\s*(cold|hot)\s*w/i, /^tempered\s*w/i],
    description: 'DOMESTIC WATER'
  },
  'INDR': {
    patterns: [/^indirect\s*dr/i],
    description: 'INDIRECT DRAIN'
  },
  'SEQP': {
    patterns: [/^equipment$/i],
    description: 'EQUIPMENT SETTING'
  },
  'DEMO': {
    patterns: [/^demo$/i, /^demolition$/i],
    description: 'DEMOLITION'
  },
  'PMPD': {
    patterns: [/pump.*discharge/i, /^sp\s+pmp/i],
    description: 'PUMP DISCHARGE'
  }
};

// LEGACY FLOOR_MAPPING - kept for initial file processing ONLY when no DB mappings exist
// Once DB floor mappings are configured, those take priority via getSectionFromFloor()
const FLOOR_MAPPING_FALLBACK = {
  '01': [/level.*0?1$/i, /^l1$/i, /floor.*1$/i, /first.*floor/i],
  '02': [/level.*0?2$/i, /^l2$/i, /floor.*2$/i, /second.*floor/i],
  '03': [/level.*0?3$/i, /^l3$/i, /floor.*3$/i, /third.*floor/i],
  'P1': [/level.*p1$/i, /^p1$/i, /parking.*1/i, /basement.*1/i],
  'P2': [/level.*p2$/i, /^p2$/i, /parking.*2/i, /basement.*2/i],
  'P3': [/level.*p3$/i, /^p3$/i, /parking.*3/i, /basement.*3/i]
};

const EnhancedCostCodeManager = () => {
  // Auth state
  const { user, loading: authLoading } = useAuth();
  
  // Project state
  const [currentProject, setCurrentProject] = useState<EstimateProject | null>(null);
  const [pendingProjectId] = useState<string | null>(
    () => localStorage.getItem('lastSelectedProjectId')
  );
  const { data: projects = [] } = useEstimateProjects();

  // Persist selected project to localStorage
  useEffect(() => {
    if (currentProject?.id) {
      localStorage.setItem('lastSelectedProjectId', currentProject.id);
      console.log('[Persist] Saved project to localStorage:', currentProject.id);
    }
  }, [currentProject?.id]);

  // Restore project selection on mount / after auth refresh
  useEffect(() => {
    if (currentProject || projects.length === 0) return;
    const lastId = pendingProjectId || localStorage.getItem('lastSelectedProjectId');
    if (!lastId) return;
    const match = projects.find(p => p.id === lastId);
    if (match) {
      console.log('[Restore] Auto-selecting project from localStorage:', match.name);
      setCurrentProject(match);
    }
  }, [projects, currentProject, pendingProjectId]);
  
  // Estimate data
  const [estimateData, setEstimateData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [activeTab, setActiveTab] = useState('upload');
  const [hasUnappliedMappingChanges, setHasUnappliedMappingChanges] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showMappingWarning, setShowMappingWarning] = useState(false);

  const handleTabChange = useCallback((tab: string) => {
    if (hasUnappliedMappingChanges && activeTab === 'mapping' && tab !== 'mapping') {
      setPendingTab(tab);
      setShowMappingWarning(true);
    } else {
      setActiveTab(tab);
    }
  }, [hasUnappliedMappingChanges, activeTab]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [notification, setNotification] = useState(null);
  const [filters, setFilters] = useState({
    floor: 'all',
    system: 'all',
    costCode: 'all',
    search: ''
  });
  const [customMappings, setCustomMappings] = useState<Record<string, { materialCode?: string; laborCode?: string }>>({});
  const [mappingHistory, setMappingHistory] = useState({});
  const [verifiedSystems, setVerifiedSystems] = useState<Record<string, { verifiedAt: string; verifiedBy: string; materialCode?: string; laborCode?: string }>>({});
  const [showCostCodeBrowser, setShowCostCodeBrowser] = useState(false);
  const [browserSearchTerm, setBrowserSearchTerm] = useState('');
  const [browserDescSearch, setBrowserDescSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [editingSystem, setEditingSystem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef(null);
  
  
  // Column configuration
  const { columns, visibleColumns, toggleColumn, resetToDefaults, autoHideEmptyColumns } = useColumnConfig();
  
  // Column filtering and sorting state
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  
  // Item type mapping state
  const [enableItemTypeMappings, setEnableItemTypeMappings] = useState(false);
  const [itemTypeMappings, setItemTypeMappings] = useState<Record<string, Record<string, { materialCode?: string; laborCode?: string }>>>({});
  const [appliedSystems, setAppliedSystems] = useState<Record<string, { appliedAt: Date; itemCount: number; appliedMaterialCode?: string; appliedLaborCode?: string }>>({});
  
  // Auto-suggestions state - stores the original auto-suggested codes per system
  const [systemAutoSuggestions, setSystemAutoSuggestions] = useState<Record<string, string>>({});
  
  // Overwrite confirmation dialog state
  const [overwriteConfirm, setOverwriteConfirm] = useState<{
    isOpen: boolean;
    systemName: string;
    newCode: string;
    existingCode: string;
    itemCount: number;
  } | null>(null);
  
  // Multi-file support state
  const [showAddFileDialog, setShowAddFileDialog] = useState(false);
  const appendEstimateItems = useAppendEstimateItems();
  const queryClient = useQueryClient();
  
  // Pending upload state - for showing confirmation when existing data
  const [pendingUploadItems, setPendingUploadItems] = useState<any[] | null>(null);
  
  // Dataset profile for intelligent floor/zone field role detection
  const [datasetProfile, setDatasetProfile] = useState<DatasetProfile | null>(null);
  const [pendingUploadFileName, setPendingUploadFileName] = useState<string>('');
  
  // Trade Section Mode state
  const [codeFormatMode, setCodeFormatMode] = useState<'standard' | 'multitrade'>('standard');
  const [tradePrefix, setTradePrefix] = useState('PL');
  const [dismissedDuplicateFlags, setDismissedDuplicateFlags] = useState<string[]>([]);

  // Load project settings when project changes
  useEffect(() => {
    if (currentProject) {
      setCodeFormatMode((currentProject as any).code_format_mode || 'standard');
      setTradePrefix((currentProject as any).trade_prefix || 'PL');
      setDismissedDuplicateFlags((currentProject as any).dismissed_duplicate_flags || []);
    }
  }, [currentProject]);

  // Budget adjustments state
  const [budgetAdjustments, setBudgetAdjustments] = useState<BudgetAdjustments | null>(null);
  const [bidLaborRate, setBidLaborRate] = useState(() => {
    // Will be updated by useEffect when currentProject loads
    return 85;
  });
  const [bidLaborRateInput, setBidLaborRateInput] = useState('85'); // String for input

  // Database hooks for persistence
  const activeProjectId = currentProject?.id || pendingProjectId;
  const { data: savedMappings = [], isFetched: mappingsFetched } = useSystemMappings(activeProjectId || null);
  const { data: savedItems = [], isLoading: itemsLoading, isFetched: itemsFetched } = useEstimateItems(activeProjectId || null);
  const saveMapping = useSaveMapping();
  const verifyMappingMutation = useVerifyMapping();
  const batchSaveMappings = useBatchSaveMappings();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const saveEstimateItems = useSaveEstimateItems();
  const batchUpdateSystemCostCodes = useBatchUpdateSystemCostCodes();
  const batchUpdateSilent = useBatchUpdateSystemCostCodesSilent();
  const updateAppliedStatus = useUpdateAppliedStatus();
  const upsertAndApplyMapping = useUpsertAndApplyMapping();
  
  // Fetch cost codes from database for smart matching
  const { data: dbCostCodes = [] } = useCostCodes();
  
  // Fetch floor-to-section mappings for labor code section derivation
  const { data: dbFloorMappings = [], isFetched: floorMappingsFetched } = useFloorSectionMappings(activeProjectId || null);
  
  // Fetch system-to-activity mappings for labor code activity segment
  const { data: dbActivityMappings = [] } = useSystemActivityMappings(activeProjectId || null);
  
  // Fetch category labor mappings for priority-based code assignment
  const { data: dbCategoryMappings = [] } = useCategoryMappings(activeProjectId || null);
  const { data: dbMaterialDescOverrides = [], isFetched: materialDescOverridesFetched } = useCategoryMaterialDescOverrides(activeProjectId || null);
  
  // Fetch building-to-section mappings for drawing-based section resolution
  const { mappings: dbBuildingMappings, autoPopulate: autoPopulateBuildings, fetchMappings: refetchBuildingMappings } = useBuildingSectionMappings(activeProjectId || null);
  
  // Fetch per-cost-head activity overrides
  const { data: costHeadActivityOverrides = [] } = useCostHeadActivityOverrides(activeProjectId || null);
  const pruneStaleCostHeadOverrides = usePruneStaleCostHeadOverrides();

  // Centralized 4-step activity resolution helper
  const resolveActivity = useCallback((
    item: { floor?: string; drawing?: string; zone?: string; system?: string; reportCat?: string; itemType?: string },
    costHead: string
  ): string => {
    // 1. Derive floor/level-based activity
    const floorMap = resolveFloorMappingStatic(item.floor || '', item.drawing || '', dbFloorMappings, dbBuildingMappings, { zone: item.zone, datasetProfile });
    const floorActivity = floorMap.activity || '0000';
    // 2. Explicit user mapping
    const explicitActivity = floorMap.hasExplicitMapping ? floorMap.activity : null;
    // 3. Check cost-head override
    const hasLevelOverride = shouldUseLevelActivity(costHead, costHeadActivityOverrides);
    // 4. Final resolution
    if (hasLevelOverride) return floorActivity;
    if (explicitActivity !== null) return explicitActivity;
    return getActivityFromSystem(item.system || '', dbActivityMappings, item.reportCat || item.itemType || undefined);
  }, [dbFloorMappings, dbBuildingMappings, datasetProfile, costHeadActivityOverrides, dbActivityMappings]);
  


          {/* Overwrite Confirmation Dialog */}
          {overwriteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <span className="text-yellow-500 text-xl">⚠️</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Overwrite Existing Codes?</h3>
                </div>
                
                <p className="text-muted-foreground mb-4">
                  <strong className="text-foreground">{overwriteConfirm.itemCount}</strong> items in <strong className="text-foreground">{overwriteConfirm.systemName}</strong> already have cost code <strong className="text-red-400">{overwriteConfirm.existingCode}</strong> assigned.
                </p>
                
                <p className="text-muted-foreground mb-6">
                  Do you want to overwrite them with <strong className="text-green-400">{overwriteConfirm.newCode}</strong>?
                </p>
                
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={handleOverwriteCancel}
                    className="px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleOverwriteConfirm}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                  >
                    Overwrite All
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Add File Dialog */}
          <AddFileDialog
            isOpen={showAddFileDialog}
            onClose={() => {
              setShowAddFileDialog(false);
              // Clear pending upload state when dialog closes
              setPendingUploadItems(null);
              setPendingUploadFileName('');
            }}
            currentProject={{
              id: currentProject?.id || '',
              name: currentProject?.name || '',
              totalItems: estimateData.length,
              sourceFiles: (currentProject as any)?.source_files || []
            }}
            onAppendData={handleAppendData}
            onReplaceData={handleReplaceData}
            preloadedItems={pendingUploadItems}
            preloadedFileName={pendingUploadFileName}
          />
        </div>

        {/* Unapplied system mapping changes warning dialog */}
        {showMappingWarning && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl border border-border">
              <h3 className="text-lg font-semibold text-foreground">Unapplied System Mapping Changes</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You have system mapping changes that haven't been applied to estimate items yet. Category mappings are saved automatically. What would you like to do?
              </p>
              <div className="mt-5 flex gap-3 justify-end">
                <button
                  onClick={() => { setShowMappingWarning(false); setPendingTab(null); }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowMappingWarning(false);
                    if (pendingTab) { setActiveTab(pendingTab); setPendingTab(null); }
                  }}
                  className="rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  Discard &amp; Continue
                </button>
                <button
                  onClick={() => {
                    setShowMappingWarning(false);
                    setPendingTab(null);
                    // Stay on mapping tab so user can click Apply All
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Go Back &amp; Apply
                </button>
              </div>
            </div>
          </div>
        )}
      {currentProject && (
        <BudgetChat
          projectName={currentProject.name || "Current Project"}
          estimateSummary={estimateSummary}
        />
      )}
      </div>
    </div>
  );
};

export default EnhancedCostCodeManager;