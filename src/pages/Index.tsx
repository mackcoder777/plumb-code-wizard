import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
  useUpdateAppliedStatus,
  useUpsertAndApplyMapping,
  EstimateProject
} from '@/hooks/useEstimateProjects';
import { useFloorSectionMappings, getSectionFromFloor } from '@/hooks/useFloorSectionMappings';
import { useSystemActivityMappings, getActivityFromSystem } from '@/hooks/useSystemActivityMappings';
import { useCategoryMappings, getLaborCodeFromCategory } from '@/hooks/useCategoryMappings';
import { useAuth } from '@/hooks/useAuth';
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
    patterns: [/^sanitary/i, /waste.*vent/i, /^dwv$/i, /soil/i, /^vent$/i],
    description: 'SANITARY WASTE AND VENT'
  },
  'STRM': {
    patterns: [/storm/i, /overflow.*dr/i, /roof.*drain/i, /rain/i],
    description: 'STORM DRAIN'
  },
  'GRWV': {
    patterns: [/grease/i, /interceptor/i, /grey.*waste/i],
    description: 'GREASE WASTE AND VENT'
  },
  'DWTR': {
    patterns: [/domestic.*water/i, /potable/i, /cold.*water/i, /hot.*water/i, /^water$/i],
    description: 'DOMESTIC WATER'
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
    patterns: [/natural.*gas/i, /fuel.*gas/i, /^gas$/i],
    description: 'NATURAL GAS'
  },
  'FNSH': {
    patterns: [/fixture/i, /toilet/i, /urinal/i, /lavatory/i, /sink/i, /faucet/i],
    description: 'FIXTURES'
  },
  'HNGS': {
    patterns: [/hanger/i, /support/i, /brace/i, /seismic/i, /strap/i],
    description: 'HANGERS AND SUPPORTS'
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
  
  // Estimate data
  const [estimateData, setEstimateData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [activeTab, setActiveTab] = useState('upload');
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
  const [pendingUploadFileName, setPendingUploadFileName] = useState<string>('');
  
  // Budget adjustments state
  const [budgetAdjustments, setBudgetAdjustments] = useState<BudgetAdjustments | null>(null);
  const [bidLaborRate, setBidLaborRate] = useState(() => {
    // Will be updated by useEffect when currentProject loads
    return 85;
  });
  const [bidLaborRateInput, setBidLaborRateInput] = useState('85'); // String for input

  // Database hooks for persistence
  const { data: savedMappings = [] } = useSystemMappings(currentProject?.id || null);
  const { data: savedItems = [], isLoading: itemsLoading } = useEstimateItems(currentProject?.id || null);
  const saveMapping = useSaveMapping();
  const verifyMappingMutation = useVerifyMapping();
  const batchSaveMappings = useBatchSaveMappings();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const saveEstimateItems = useSaveEstimateItems();
  const batchUpdateSystemCostCodes = useBatchUpdateSystemCostCodes();
  const updateAppliedStatus = useUpdateAppliedStatus();
  const upsertAndApplyMapping = useUpsertAndApplyMapping();
  
  // Fetch cost codes from database for smart matching
  const { data: dbCostCodes = [] } = useCostCodes();
  
  // Fetch floor-to-section mappings for labor code section derivation
  const { data: dbFloorMappings = [] } = useFloorSectionMappings(currentProject?.id || null);
  
  // Fetch system-to-activity mappings for labor code activity segment
  const { data: dbActivityMappings = [] } = useSystemActivityMappings(currentProject?.id || null);
  
  // Fetch category labor mappings for priority-based code assignment
  const { data: dbCategoryMappings = [] } = useCategoryMappings(currentProject?.id || null);
  
  // Convert DB floor mappings to a simple key-value map for easy lookup
  const floorSectionMap = useMemo<FloorSectionMap>(() => {
    const map: FloorSectionMap = {};
    dbFloorMappings.forEach(m => {
      map[m.floor_pattern] = m.section_code;
    });
    return map;
  }, [dbFloorMappings]);

  // Load saved mappings when project changes - MERGE with existing local state to prevent reset
  useEffect(() => {
    if (savedMappings.length > 0) {
      const mappings: Record<string, { materialCode?: string; laborCode?: string }> = {};
      const verified: Record<string, { verifiedAt: string; verifiedBy: string; costHead: string }> = {};
      const autoSuggestions: Record<string, string> = {};
      
      savedMappings.forEach(m => {
        // Parse the combined cost_head format "materialCode|laborCode" back into object
        const costHead = m.cost_head || '';
        const [materialCode, laborCode] = costHead.includes('|') 
          ? costHead.split('|') 
          : ['', costHead]; // Legacy format: just labor code
        
        mappings[m.system_name] = {
          materialCode: materialCode || undefined,
          laborCode: laborCode || undefined
        };
        
        if (m.is_verified) {
          verified[m.system_name] = {
            verifiedAt: m.verified_at || new Date().toISOString(),
            verifiedBy: m.verified_by || 'user',
            costHead: m.cost_head
          };
        }
        // Load stored auto-suggestions
        if (m.auto_suggested) {
          autoSuggestions[m.system_name] = m.auto_suggested;
        }
      });
      
      setCustomMappings(mappings);
      setVerifiedSystems(verified);
      setSystemAutoSuggestions(prev => ({ ...prev, ...autoSuggestions }));
      
      // MERGE applied systems - DB state takes precedence but preserve local state
      setAppliedSystems(prevApplied => {
        const dbApplied: Record<string, { appliedAt: Date; itemCount: number; appliedCode?: string }> = {};
        
        savedMappings.forEach(m => {
          if (m.applied_at && m.cost_head) {
            dbApplied[m.system_name] = {
              appliedAt: new Date(m.applied_at),
              itemCount: m.applied_item_count || 0,
              appliedCode: m.cost_head
            };
          }
        });
        
        // Merge: DB state takes precedence, but preserve local state for systems not yet in DB
        return {
          ...prevApplied,
          ...dbApplied
        };
      });
    }
  }, [savedMappings]);

  // Load bid labor rate from localStorage when project changes
  useEffect(() => {
    if (currentProject?.id) {
      const savedRate = localStorage.getItem(`bid_labor_rate_${currentProject.id}`);
      if (savedRate) {
        const rate = parseFloat(savedRate);
        setBidLaborRate(rate);
        setBidLaborRateInput(rate.toString());
        console.log('[Index] Loaded bid labor rate from localStorage:', rate);
      }
    }
  }, [currentProject?.id]);

  // Persist bid labor rate to localStorage when it changes
  useEffect(() => {
    if (currentProject?.id && bidLaborRate) {
      localStorage.setItem(`bid_labor_rate_${currentProject.id}`, bidLaborRate.toString());
    }
  }, [bidLaborRate, currentProject?.id]);

  // Helper function for auto-detecting cost codes
  const autoDetectCostCode = (description: string): string => {
    const desc = description.toLowerCase();
    
    // Pattern matching for auto-detection
    if (desc.includes('snow') || desc.includes('snwv')) return 'SNWV';
    if (desc.includes('storm') || desc.includes('strm')) return 'STRM';
    if (desc.includes('sani') || desc.includes('sanitary')) return 'SNWV';
    if (desc.includes('water') || desc.includes('dwtr')) return 'DWTR';
    if (desc.includes('seismic') || desc.includes('szmc')) return 'SZMC';
    if (desc.includes('fire') || desc.includes('firewater')) return 'FNSH';
    if (desc.includes('gas') || desc.includes('natural')) return 'NGAS';
    if (desc.includes('drain') || desc.includes('drns')) return 'DRNS';
    
    // Default fallback
    return 'SNWV';
  };

  // Count total codes in database
  const getTotalCodes = () => {
    let total = 0;
    Object.values(STANDARD_COST_CODES).forEach(category => {
      Object.values(category).forEach(subcat => {
        total += subcat.length;
      });
    });
    return total;
  };

  // Get all codes as flat array
  const getAllCodes = () => {
    const allCodes = [];
    Object.entries(STANDARD_COST_CODES).forEach(([categoryName, categories]) => {
      Object.entries(categories).forEach(([subcatName, codes]) => {
        codes.forEach(code => {
          allCodes.push({
            ...code,
            category: categoryName,
            subcategory: subcatName
          });
        });
      });
    });
    return allCodes;
  };

  const COST_CODES = getAllCodes();

  // Helper to get section from floor - uses DB mappings first, falls back to patterns
  const getSectionForFloor = useCallback((floor: string): string => {
    // Priority 1: Use database floor mappings if available
    if (dbFloorMappings.length > 0) {
      const section = getSectionFromFloor(floor, dbFloorMappings);
      if (section !== '01') return section; // Return if found non-default
    }
    
    // Priority 2: Fallback to hardcoded patterns (for initial setup before DB mappings)
    const floorText = (floor || '').toLowerCase().trim();
    for (const [code, patterns] of Object.entries(FLOOR_MAPPING_FALLBACK)) {
      if (patterns.some(pattern => pattern.test(floorText))) {
        return code;
      }
    }
    
    // Default
    return '01';
  }, [dbFloorMappings]);

  // Generate cost code with audit trail - uses smart matching against database codes
  const generateCostCode = useCallback((item) => {
    // Use database floor mappings for section
    const section = getSectionForFloor(item.floor || '');

    // Get activity code from system-to-activity mappings
    const activity = getActivityFromSystem(item.system || '', dbActivityMappings);
    const systemLower = (item.system || '').toLowerCase().trim();

    // Priority 1: Check custom mappings (user overrides) - labor code takes priority for cost code assignment
    const customMapping = customMappings[systemLower];
    let costHead = (typeof customMapping === 'object' ? customMapping?.laborCode : customMapping) || null;
    let confidence = costHead ? 1.0 : 0;
    let source = costHead ? 'custom' : '';
    let matchReason = costHead ? 'Manual mapping' : '';

    // Priority 2: Check hardcoded patterns
    if (!costHead) {
      for (const [code, config] of Object.entries(DEFAULT_COST_HEAD_MAPPING)) {
        if (config.patterns.some(pattern => pattern.test(systemLower))) {
          costHead = code;
          confidence = 0.9;
          source = 'auto-pattern';
          matchReason = `Pattern match: ${config.description}`;
          break;
        }
      }
    }

    // Priority 3: Smart matching against database cost codes
    if (!costHead && dbCostCodes.length > 0) {
      const match = findBestMatch(item.system, dbCostCodes, 'L'); // Prefer Labor codes
      if (match && match.confidence >= 0.5) {
        costHead = match.code;
        confidence = match.confidence;
        source = 'smart-match';
        matchReason = match.matchReason;
      }
    }

    // Priority 4: No match found - leave unassigned
    if (!costHead) {
      costHead = '';
      confidence = 0;
      source = 'unassigned';
      matchReason = 'No confident match found';
    }

    // Find description from database or hardcoded codes
    const description = dbCostCodes.find(c => c.code === costHead)?.description ||
                       DEFAULT_COST_HEAD_MAPPING[costHead]?.description || 
                       Object.values(STANDARD_COST_CODES).flatMap(cat => 
                         Object.values(cat).flat()
                       ).find(c => c.code === costHead)?.description || 
                       (costHead ? 'Unknown' : 'Unassigned');

    return {
      code: costHead ? `${section} ${activity} ${costHead}` : '',
      section: section,
      activity: activity,
      costHead: costHead,
      confidence: confidence,
      source: source,
      matchReason: matchReason,
      description: description
    };
  }, [customMappings, dbCostCodes, dbActivityMappings, getSectionForFloor]);

  // Load saved items when project changes - apply category mappings during load
  useEffect(() => {
    if (savedItems.length > 0 && currentProject?.id) {
      // Transform database items to the format used by the UI
      // AND apply category labor mappings during transformation
      const transformedItems = savedItems.map((item) => {
        // Start with base transformation
        const baseItem = {
          id: item.id,
          drawing: item.drawing || '',
          system: item.system || '',
          floor: item.floor || '',
          zone: item.zone || '',
          symbol: item.symbol || '',
          estimator: item.estimator || '',
          materialSpec: item.material_spec || '',
          itemType: item.item_type || '',
          reportCat: item.report_cat || '',
          trade: item.trade || '',
          materialDesc: item.material_desc || '',
          itemName: item.item_name || '',
          size: item.size || '',
          quantity: item.quantity || 0,
          listPrice: item.list_price || 0,
          materialDollars: item.material_dollars || 0,
          weight: item.weight || 0,
          hours: item.hours || 0,
          laborDollars: item.labor_dollars || 0,
          costCode: item.cost_code || '',
          materialCostCode: (item as any).material_cost_code || '',
          sourceFile: item.source_file || '',
          excludedFromMaterialBudget: (item as any).excluded_from_material_budget || false,
          suggestedCode: generateCostCode({
            system: item.system || '',
            floor: item.floor || ''
          })
        };
        
        // Apply category labor mapping ONLY if item doesn't already have a saved cost_code
        // This preserves system mappings that were already applied and saved to the database
        if (!item.cost_code && dbCategoryMappings.length > 0 && item.report_cat) {
          const categoryCode = getLaborCodeFromCategory(item.report_cat, dbCategoryMappings);
          if (categoryCode) {
            // Build the full cost code with section (from DB floor mappings) and activity
            const section = getSectionFromFloor(item.floor || '', dbFloorMappings);
            const activity = getActivityFromSystem(item.system || '', dbActivityMappings);
            baseItem.costCode = `${section} ${activity} ${categoryCode}`;
          }
        }
        
        return baseItem;
      });
      
      const appliedCount = transformedItems.filter(i => i.costCode).length;
      const preservedCount = savedItems.filter(i => i.cost_code).length;
      console.log(`[Load] Loaded ${transformedItems.length} items, ${preservedCount} had saved labor codes (preserved), ${appliedCount - preservedCount} got category mappings applied`);
      
      setEstimateData(transformedItems);
      setFilteredData(transformedItems);
      setFileName(currentProject.file_name || '');
    }
  }, [savedItems, currentProject?.id, currentProject?.file_name, generateCostCode, dbCategoryMappings, dbFloorMappings, dbActivityMappings]);

  // Web Worker for Excel parsing (off main thread)
  const handleFileUpload = useCallback((file: File | undefined) => {
    if (!file) return;
    
    setLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Initializing...');
    setFileName(file.name);
    
    const startTime = performance.now();
    let worker: Worker | null = null;
    
    const reader = new FileReader();
    
    // Phase 1: File Reading (0-15%)
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentLoaded = Math.round((event.loaded / event.total) * 15);
        setLoadingProgress(percentLoaded);
        const elapsed = (performance.now() - startTime) / 1000;
        const rate = event.loaded / elapsed;
        const remaining = (event.total - event.loaded) / rate;
        setEstimatedTime(`Reading: ${Math.ceil(remaining)}s`);
      }
    };
    
    reader.onload = async (e) => {
      try {
        setLoadingProgress(15);
        setLoadingMessage('Creating worker thread...');
        
        // Create inline Web Worker with header-based column detection
        const workerCode = `
          importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
          
          self.onmessage = async function(e) {
            const { data, action, fileName } = e.data;
            
            if (action === 'parse') {
              try {
                self.postMessage({ type: 'progress', progress: 15, message: 'Parsing Excel structure...' });
                
                const workbook = XLSX.read(data, { type: 'array' });
                
                self.postMessage({ type: 'progress', progress: 30, message: 'Finding Raw Data sheet...' });
                
                const sheet = workbook.Sheets['Raw Data'];
                if (!sheet) {
                  throw new Error('Raw Data sheet not found. Please ensure your Excel file has a "Raw Data" sheet.');
                }
                
                // Use header: 1 to get raw arrays for proper column detection
                const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                
                console.log('=== WEB WORKER DEBUG ===');
                console.log('Total rows in sheet:', rawData.length);
                
                self.postMessage({ type: 'progress', progress: 40, message: 'Detecting column headers...' });
                
                // Find header row - scan first 10 rows for row containing "system" and "drawing"
                let headerRowIndex = 0;
                for (let i = 0; i < Math.min(10, rawData.length); i++) {
                  const row = rawData[i];
                  if (!row || !Array.isArray(row)) continue;
                  const rowStr = row.map(cell => String(cell || '').toLowerCase().trim());
                  if (rowStr.includes('system') && rowStr.includes('drawing')) {
                    headerRowIndex = i;
                    break;
                  }
                }
                
                const headers = (rawData[headerRowIndex] || []).map(h => String(h || '').toLowerCase().trim());
                console.log('Header row index:', headerRowIndex);
                console.log('Headers found:', headers.slice(0, 30));
                
                // Find column indices by header name
                const findCol = function(...terms) {
                  for (const term of terms) {
                    for (let i = 0; i < headers.length; i++) {
                      const h = headers[i];
                      if (term.startsWith('=')) {
                        if (h === term.slice(1)) return i;
                      } else {
                        if (h.includes(term)) return i;
                      }
                    }
                  }
                  return -1;
                };
                
                // FIXED COLUMN POSITIONS: Z=25 (Material w/Factor), AA=26 (Hours w/Factor)
                const colMap = {
                  drawing: findCol('=drawing'),
                  system: findCol('=system'),
                  floor: findCol('=floor'),
                  zone: findCol('=zone'),
                  symbol: findCol('=symbol'),
                  estimator: findCol('=estimator'),
                  materialSpec: findCol('material spec'),
                  itemType: findCol('item type'),
                  reportCat: findCol('report cat'),
                  trade: findCol('=trade'),
                  materialDescription: findCol('material description', 'material desc'),
                  itemName: findCol('item name'),
                  size: findCol('=size'),
                  quantity: findCol('=quantity'),
                  listPrice: findCol('list price'),
                  multiplier: findCol('=multiplier'),
                  // Material Dollars: Try header detection first, fallback to Column Z (index 25)
                  materialDollars: findCol('material w/factor', 'material dollar') !== -1 
                    ? findCol('material w/factor', 'material dollar') 
                    : 25,
                  weight: findCol('=weight'),
                  // CRITICAL: Total Hours - Try header detection first, fallback to Column AA (index 26)
                  fieldHours: findCol('hours w/factor', 'field hour', 'field hours', 'total hour', 'total hours') !== -1
                    ? findCol('hours w/factor', 'field hour', 'field hours', 'total hour', 'total hours')
                    : 26,
                  unitHours: findCol('=hours'),
                  laborDollars: findCol('labor dollar'),
                };
                
                console.log('Column map:', JSON.stringify(colMap));
                console.log('fieldHours col:', colMap.fieldHours, '-> "' + headers[colMap.fieldHours] + '"');
                
                if (colMap.system === -1) {
                  throw new Error('Could not find "System" column in spreadsheet');
                }
                
                self.postMessage({ type: 'progress', progress: 50, message: 'Processing data rows...' });
                
                // Process data rows - stop when System is empty (formula rows)
                const dataStartRow = headerRowIndex + 1;
                const items = [];
                let totalHours = 0;
                let totalMaterial = 0;
                
                for (let i = dataStartRow; i < rawData.length; i++) {
                  const row = rawData[i];
                  if (!row || row.length < 5) continue;
                  
                  // CRITICAL: Stop at rows where System is empty (user formula rows)
                  const system = row[colMap.system];
                  if (!system || String(system).trim() === '') continue;
                  
                  const drawing = row[colMap.drawing];
                  if (!drawing || String(drawing).trim() === '') continue;
                  
                  // Use Field Hours directly (Column AA) - already contains total hours
                  let hours = 0;
                  if (colMap.fieldHours !== -1) {
                    const val = row[colMap.fieldHours];
                    if (val !== '' && val != null && !isNaN(parseFloat(val))) {
                      hours = parseFloat(val) || 0;
                    }
                  } else if (colMap.unitHours !== -1) {
                    // Fallback only if Field Hours column missing
                    const unitHrs = parseFloat(row[colMap.unitHours]) || 0;
                    const qty = parseFloat(row[colMap.quantity]) || 1;
                    hours = unitHrs * qty;
                  }
                  
                  const materialDollars = parseFloat(row[colMap.materialDollars]) || 0;
                  totalHours += hours;
                  totalMaterial += materialDollars;
                  
                  items.push({
                    drawing: String(drawing),
                    system: String(system),
                    floor: String(row[colMap.floor] || ''),
                    zone: String(row[colMap.zone] || ''),
                    symbol: String(row[colMap.symbol] || ''),
                    estimator: String(row[colMap.estimator] || ''),
                    materialSpec: String(row[colMap.materialSpec] || ''),
                    itemType: String(row[colMap.itemType] || ''),
                    reportCat: String(row[colMap.reportCat] || ''),
                    trade: String(row[colMap.trade] || ''),
                    materialDescription: String(row[colMap.materialDescription] || ''),
                    itemName: String(row[colMap.itemName] || ''),
                    size: String(row[colMap.size] || ''),
                    quantity: parseFloat(row[colMap.quantity]) || 0,
                    listPrice: parseFloat(row[colMap.listPrice]) || 0,
                    multiplier: parseFloat(row[colMap.multiplier]) || 1,
                    materialDollars: materialDollars,
                    weight: parseFloat(row[colMap.weight]) || 0,
                    hours: hours,
                    laborDollars: parseFloat(row[colMap.laborDollars]) || 0,
                  });
                }
                
                console.log('=== PARSING COMPLETE ===');
                console.log('Items:', items.length);
                console.log('Total Hours:', totalHours.toFixed(2));
                console.log('Expected: 1,568.43');
                console.log('Match:', totalHours > 1560 && totalHours < 1580 ? 'YES ✓' : 'NO ✗');
                
                // Send items in chunks
                const CHUNK_SIZE = 100;
                const totalChunks = Math.ceil(items.length / CHUNK_SIZE);
                
                for (let i = 0; i < items.length; i += CHUNK_SIZE) {
                  const chunk = items.slice(i, i + CHUNK_SIZE);
                  const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
                  const progress = 50 + Math.round((chunkNum / totalChunks) * 30);
                  
                  self.postMessage({
                    type: 'chunk',
                    chunk: chunk,
                    chunkNumber: chunkNum,
                    totalChunks: totalChunks,
                    totalRows: items.length,
                    progress: progress,
                    message: 'Processing chunk ' + chunkNum + ' of ' + totalChunks + '...'
                  });
                  
                  await new Promise(resolve => setTimeout(resolve, 0));
                }
                
                self.postMessage({
                  type: 'transfer-complete',
                  totalRows: items.length,
                  totalHours: totalHours,
                  progress: 80,
                  message: 'Complete! ' + items.length + ' items, ' + totalHours.toFixed(1) + ' hours'
                });
                
              } catch (error) {
                console.error('Worker error:', error);
                self.postMessage({ type: 'error', error: error.message });
              }
            }
          };
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        worker = new Worker(workerUrl);
        
        // Handle worker messages
        let processedData: any[] = [];
        let processedItemsCount = 0;
        let expectedTotalRows = 0;
        const chunkStartTime = performance.now();
        
        worker.onmessage = async (event) => {
          const { type, progress, message, chunk, error, totalRows, chunkNumber, totalChunks } = event.data;
          
          if (type === 'progress') {
            setLoadingProgress(progress);
            setLoadingMessage(message);
            
            // During conversion phase (40-65%), show processing message
            if (progress >= 40 && progress < 65) {
              setEstimatedTime('Processing...');
            } else {
              // Early phases - rough estimate
              const elapsed = (performance.now() - startTime) / 1000;
              const estimatedTotal = elapsed / (progress / 100);
              const remaining = Math.max(0, estimatedTotal - elapsed);
              setEstimatedTime(remaining > 1 ? `~${Math.ceil(remaining)}s` : 'Almost done...');
            }
            
          } else if (type === 'chunk') {
            // Worker already processed and filtered data - just add IDs and source file
            const processedChunk = chunk.map((row: any, index: number) => ({
              id: processedItemsCount + index,
              drawing: row.drawing,
              system: row.system,
              floor: row.floor,
              zone: row.zone,
              symbol: row.symbol,
              estimator: row.estimator,
              materialSpec: row.materialSpec,
              itemType: row.itemType,
              reportCat: row.reportCat,
              trade: row.trade,
              materialDesc: row.materialDescription,
              itemName: row.itemName,
              size: row.size,
              quantity: row.quantity,
              listPrice: row.listPrice,
              materialDollars: row.materialDollars,
              weight: row.weight,
              hours: row.hours,
              laborDollars: row.laborDollars,
              costCode: '',
              materialCostCode: '',
              sourceFile: file.name,
              suggestedCode: generateCostCode({
                system: row.system,
                floor: row.floor
              })
            }));
            
            processedData.push(...processedChunk);
            processedItemsCount += processedChunk.length;
            expectedTotalRows = totalRows;
            
            // Update progress
            setLoadingProgress(progress);
            setLoadingMessage(`Processing chunk ${chunkNumber} of ${totalChunks}... (${processedItemsCount.toLocaleString()} of ${totalRows.toLocaleString()} items)`);
            
            // Calculate processing rate
            if (processedItemsCount > 200) {
              const elapsed = (performance.now() - chunkStartTime) / 1000;
              const itemsPerSecond = Math.round(processedItemsCount / elapsed);
              const remainingItems = totalRows - processedItemsCount;
              const estimatedRemaining = Math.ceil(remainingItems / Math.max(itemsPerSecond, 10));
              
              setEstimatedTime(`${estimatedRemaining}s (${itemsPerSecond} items/s)`);
            } else {
              setEstimatedTime('Calculating processing rate...');
            }
            
          } else if (type === 'transfer-complete') {
            // Clean up worker
            worker?.terminate();
            URL.revokeObjectURL(workerUrl);
            
            // All processing already done incrementally - just finalize
            setLoadingProgress(85);
            setLoadingMessage(`Finalizing ${processedData.length.toLocaleString()} items...`);
            
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Initialize mappings
            const systems = [...new Set(processedData.map(item => 
              item.system.toLowerCase().trim()
            ))].filter(Boolean);
            
            const mappings: Record<string, { materialCode?: string; laborCode?: string }> = {};
            const history: Record<string, any[]> = {};
            
            systems.forEach(system => {
              if (system.includes('storm') || system.includes('overflow')) {
                mappings[system] = { laborCode: 'STRM' };
                history[system] = [{
                  timestamp: new Date().toISOString(),
                  user: 'system',
                  from: 'SNWV',
                  to: 'STRM',
                  reason: 'Auto-detected storm/overflow drain'
                }];
              }
            });
            
            setCustomMappings(mappings);
            setMappingHistory(history);
            setEstimateData(processedData);
            setFilteredData(processedData);
            
            // Helper to save items to database
            const saveItemsToDb = async (projectId: string) => {
              try {
                const itemsToSave = processedData.map((item, index) => ({
                  row_number: index,
                  drawing: item.drawing || '',
                  system: item.system || '',
                  floor: item.floor || '',
                  zone: item.zone || '',
                  symbol: item.symbol || '',
                  estimator: item.estimator || '',
                  material_spec: item.materialSpec || '',
                  item_type: item.itemType || '',
                  report_cat: item.reportCat || '',
                  trade: item.trade || '',
                  material_desc: item.materialDesc || '',
                  item_name: item.itemName || '',
                  size: item.size || '',
                  quantity: item.quantity || 0,
                  list_price: item.listPrice || 0,
                  material_dollars: item.materialDollars || 0,
                  weight: item.weight || 0,
                  hours: item.hours || 0,
                  labor_dollars: item.laborDollars || 0,
                  cost_code: item.costCode || '',
                  material_cost_code: item.materialCostCode || '',
                  source_file: fileName,
                }));
                
                setLoadingMessage(`Saving ${itemsToSave.length.toLocaleString()} items to database...`);
                setLoadingProgress(90);
                
                await saveEstimateItems.mutateAsync({
                  projectId,
                  items: itemsToSave,
                  onProgress: (progress) => {
                    setLoadingProgress(90 + Math.round(progress * 0.08));
                  }
                });
              } catch (error) {
                console.error('Failed to save items:', error);
                showNotification('Warning: Items loaded but not saved to database', 'error');
              }
            };
            
            // Auto-create project if user is logged in and no project selected
            if (user && !currentProject) {
              const projectName = fileName.replace(/\.[^/.]+$/, '') || `Estimate ${new Date().toLocaleDateString()}`;
              createProject.mutate({
                name: projectName,
                fileName: fileName,
                totalItems: processedData.length
              }, {
                onSuccess: async (newProject) => {
                  setCurrentProject(newProject);
                  // Save items to database
                  await saveItemsToDb(newProject.id);
                  // Save initial mappings to database
                  if (Object.keys(mappings).length > 0) {
                    const mappingsToSave = Object.entries(mappings).map(([systemName, costHead]) => ({
                      systemName,
                      costHead: costHead as string
                    }));
                    batchSaveMappings.mutate({
                      projectId: newProject.id,
                      mappings: mappingsToSave
                    });
                  }
                }
              });
            } else if (currentProject) {
              // Check if project already has data - show confirmation dialog
              if (estimateData.length > 0) {
                // Store pending data and show AddFileDialog for user to choose
                setPendingUploadItems(processedData);
                setPendingUploadFileName(fileName);
                setShowAddFileDialog(true);
                setLoading(false);
                setLoadingProgress(0);
                return; // Exit early - let AddFileDialog handle the rest
              }
              
              // No existing data - proceed with normal save
              updateProject.mutate({
                id: currentProject.id,
                file_name: fileName,
                total_items: processedData.length
              });
              await saveItemsToDb(currentProject.id);
            }
            
            const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
            setLoadingProgress(100);
            setLoadingMessage(`Complete! ${processedData.length.toLocaleString()} items in ${totalTime}s`);
            
            setTimeout(() => {
              setLoading(false);
              setActiveTab('estimates');
              showNotification(`Successfully loaded ${processedData.length.toLocaleString()} items`, 'success');
            }, 800);
            
          } else if (type === 'error') {
            worker?.terminate();
            URL.revokeObjectURL(workerUrl);
            console.error('Worker error:', error);
            showNotification(`Error: ${error}`, 'error');
            setLoading(false);
          }
        };
        
        worker.onerror = (error) => {
          console.error('Worker error:', error);
          showNotification('Error processing file in worker', 'error');
          setLoading(false);
          worker?.terminate();
          URL.revokeObjectURL(workerUrl);
        };
        
        // Send data to worker
        const arrayBuffer = e.target?.result as ArrayBuffer;
        worker.postMessage({ action: 'parse', data: arrayBuffer });
        
      } catch (error) {
        console.error('Processing error:', error);
        showNotification(`Error: ${(error as Error).message}`, 'error');
        setLoading(false);
        if (worker) {
          worker.terminate();
        }
      }
    };
    
    reader.onerror = () => {
      showNotification('Error reading file', 'error');
      setLoading(false);
    };
    
    reader.readAsArrayBuffer(file);
  }, [generateCostCode]);

  // Update all items when mappings change
  useEffect(() => {
    if (estimateData.length > 0) {
      const updated = estimateData.map(item => ({
        ...item,
        suggestedCode: generateCostCode(item)
      }));
      setEstimateData(updated);
      setFilteredData(updated);
    }
  }, [customMappings, generateCostCode]);

  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Auto-hide empty columns when data loads
  useEffect(() => {
    if (estimateData.length > 0) {
      autoHideEmptyColumns(estimateData);
    }
  }, [estimateData.length]); // Only run when data count changes (new upload)

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...estimateData];

    // Apply dropdown filters (legacy)
    if (filters.floor !== 'all') {
      filtered = filtered.filter(item => item.floor === filters.floor);
    }
    if (filters.system !== 'all') {
      filtered = filtered.filter(item => item.system === filters.system);
    }
    if (filters.costCode === 'unassigned') {
      filtered = filtered.filter(item => !item.costCode);
    } else if (filters.costCode !== 'all') {
      filtered = filtered.filter(item => item.costCode === filters.costCode);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(item => 
        item.materialDesc?.toLowerCase().includes(search) ||
        item.itemName?.toLowerCase().includes(search) ||
        item.drawing?.toLowerCase().includes(search)
      );
    }

    // Apply column-specific filters (Excel-style)
    Object.entries(columnFilters).forEach(([columnKey, selectedValues]) => {
      if (selectedValues.size > 0) {
        filtered = filtered.filter(item => {
          const val = item[columnKey];
          const strVal = val !== undefined && val !== null ? String(val).trim() : '';
          const checkVal = strVal || '(Blanks)';
          return selectedValues.has(checkVal);
        });
      }
    });

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        // Handle nulls/undefined
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bVal == null) return sortConfig.direction === 'asc' ? -1 : 1;
        
        // Handle numbers
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Handle strings
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (sortConfig.direction === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    setFilteredData(filtered);
  }, [estimateData, filters, columnFilters, sortConfig]);

  // Reset to page 1 when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters, sortConfig, filters]);

  // Handlers for column filters
  const handleColumnFilterChange = useCallback((columnKey: string, selectedValues: Set<string>) => {
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      if (selectedValues.size === 0) {
        delete newFilters[columnKey];
      } else {
        newFilters[columnKey] = selectedValues;
      }
      return newFilters;
    });
  }, []);

  const handleSortChange = useCallback((columnKey: string, direction: 'asc' | 'desc') => {
    setSortConfig({ key: columnKey, direction });
  }, []);

  const clearAllColumnFilters = useCallback(() => {
    setColumnFilters({});
    setSortConfig(null);
  }, []);

  // Show auth if not logged in - MUST be after all hooks
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  // Auto-assign cost codes
  const autoAssignCostCodes = () => {
    let assigned = 0;
    const updated = estimateData.map(item => {
      if (!item.costCode && item.suggestedCode && item.suggestedCode.confidence >= 0.8) {
        assigned++;
        return { ...item, costCode: item.suggestedCode.code };
      }
      return item;
    });

    setEstimateData(updated);
    showNotification(`Auto-assigned ${assigned} cost codes with high confidence`, 'success');
  };

  // Apply mapping to all items of a specific system (also marks as verified)
  // Now supports dual codes: materialCode and laborCode
  const applyMappingToSystem = (system: string, materialCode?: string, laborCode?: string) => {
    const systemLower = system.toLowerCase().trim();
    
    // Find ALL items in this system (not just ones without cost codes)
    const systemItems = estimateData.filter(
      item => item.system?.toLowerCase().trim() === systemLower
    );
    
    if (systemItems.length === 0) {
      showNotification(`No items found for system: ${system}`, 'error');
      return;
    }
    
    // Check if any items already have DIFFERENT codes assigned
    const hasConflict = systemItems.some(
      item => (laborCode && item.costCode && item.costCode !== laborCode) ||
              (materialCode && item.materialCostCode && item.materialCostCode !== materialCode)
    );
    
    // For now, apply directly (skip complex confirmation for dual codes)
    executeApplyDualCodes(system, materialCode, laborCode, systemItems.length);
  };

  // Execute the actual apply logic with BOTH material and labor codes
  // CRITICAL: Builds FULL cost codes per item with section from floor mappings
  const executeApplyDualCodes = (system: string, materialCode?: string, laborCode?: string, itemCount?: number) => {
    const systemLower = system.toLowerCase().trim();
    
    const systemItems = estimateData.filter(
      item => item.system?.toLowerCase().trim() === systemLower
    );
    const count = itemCount || systemItems.length;
    
    // Build per-item updates with FULL assembled cost codes (section varies by floor)
    const itemUpdates: Array<{ id: string; cost_code?: string; material_cost_code?: string }> = [];
    
    // Update ALL items in this system with BOTH codes - build FULL code per item
    const updated = estimateData.map(item => {
      if (item.system?.toLowerCase().trim() === systemLower) {
        // Get section from floor mappings for THIS specific item's floor
        const section = getSectionFromFloor(item.floor || '', dbFloorMappings);
        const activity = getActivityFromSystem(item.system || '', dbActivityMappings);
        
        // Build the FULL assembled labor code with section and activity
        const fullLaborCode = laborCode ? `${section} ${activity} ${laborCode}` : item.costCode;
        
        // Track this item for database update
        if (typeof item.id === 'string') {
          itemUpdates.push({
            id: item.id,
            cost_code: fullLaborCode || undefined,
            material_cost_code: materialCode || undefined
          });
        }
        
        return { 
          ...item, 
          costCode: fullLaborCode,
          materialCostCode: materialCode || item.materialCostCode,
          suggestedCode: {
            ...item.suggestedCode,
            code: fullLaborCode,
            costHead: laborCode || item.costCode,
            source: 'system-mapping'
          }
        };
      }
      return item;
    });

    setEstimateData(updated);
    
    // Track applied status locally with BOTH codes
    setAppliedSystems(prev => ({
      ...prev,
      [systemLower]: {
        appliedAt: new Date(),
        itemCount: count,
        appliedMaterialCode: materialCode,
        appliedLaborCode: laborCode
      }
    }));
    
    // Also mark as verified automatically when applied
    setVerifiedSystems(prev => ({
      ...prev,
      [systemLower]: {
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'user',
        materialCode: materialCode,
        laborCode: laborCode
      }
    }));
    
    // Persist to database if project exists
    if (currentProject?.id) {
      // Get the original auto-suggestion for persistence
      const originalAutoSuggested = systemAutoSuggestions[systemLower] || generateCostCode({ system }).costHead;
      
      // Update cost codes on estimate items with FULL assembled codes per item
      if (itemUpdates.length > 0) {
        console.log(`[Apply] Saving ${itemUpdates.length} items with full codes to database`);
        batchUpdateSystemCostCodes.mutate({
          projectId: currentProject.id,
          system: system,
          itemUpdates: itemUpdates // Pass per-item updates with full assembled codes
        });
      }
      
      // UPSERT the mapping with applied status - store both codes in cost_head as "material|labor"
      const combinedCostHead = `${materialCode || ''}|${laborCode || ''}`;
      upsertAndApplyMapping.mutate({
        projectId: currentProject.id,
        systemName: system,
        costHead: combinedCostHead,
        itemCount: count,
        autoSuggested: originalAutoSuggested
      });
      
      // Store auto-suggestion locally if not already set
      if (!systemAutoSuggestions[systemLower]) {
        setSystemAutoSuggestions(prev => ({
          ...prev,
          [systemLower]: originalAutoSuggested
        }));
      }
    }
    
    const codesApplied = [
      materialCode && `Material: ${materialCode}`,
      laborCode && `Labor: ${laborCode}`
    ].filter(Boolean).join(', ');
    
    showNotification(`Applied ${codesApplied || 'codes'} to ${count} items in ${system}`, 'success');
  };

  // Legacy single-code apply for backward compatibility
  const executeApplyMapping = (system: string, costHead: string, itemCount: number) => {
    executeApplyDualCodes(system, undefined, costHead, itemCount);
  };

  // Handle overwrite confirmation
  const handleOverwriteConfirm = () => {
    if (!overwriteConfirm) return;
    
    const { systemName, newCode } = overwriteConfirm;
    const systemLower = systemName.toLowerCase().trim();
    
    const itemCount = estimateData.filter(
      item => item.system?.toLowerCase().trim() === systemLower
    ).length;
    
    setOverwriteConfirm(null);
    executeApplyMapping(systemName, newCode, itemCount);
  };

  const handleOverwriteCancel = () => {
    setOverwriteConfirm(null);
  };

  // Verify/confirm a system mapping
  const verifyMapping = (system: string, costHead: string) => {
    const systemLower = system.toLowerCase().trim();
    setVerifiedSystems(prev => ({
      ...prev,
      [systemLower]: {
        verifiedAt: new Date().toISOString(),
        verifiedBy: 'user',
        costHead: costHead
      }
    }));
    
    // Persist to database if project exists
    if (currentProject?.id) {
      verifyMappingMutation.mutate({
        projectId: currentProject.id,
        systemName: system,
        isVerified: true
      });
    }
    
    showNotification(`Verified mapping for ${system} → ${costHead}`, 'success');
  };

  // Unverify a system mapping
  const unverifyMapping = (system: string) => {
    const systemLower = system.toLowerCase().trim();
    setVerifiedSystems(prev => {
      const newVerified = { ...prev };
      delete newVerified[systemLower];
      return newVerified;
    });
    
    // Persist to database if project exists
    if (currentProject?.id) {
      verifyMappingMutation.mutate({
        projectId: currentProject.id,
        systemName: system,
        isVerified: false
      });
    }
    
    showNotification(`Removed verification for ${system}`, 'info');
  };

  // Update custom mapping with audit trail
  const updateMapping = (system, costHead, userName = 'user') => {
    const systemLower = system.toLowerCase().trim();
    const history = mappingHistory[systemLower] || [];
    const currentMapping = customMappings[systemLower];
    
    // Get the original auto-suggestion (from state or generate fresh)
    const originalAutoSuggested = systemAutoSuggestions[systemLower] || generateCostCode({ system }).costHead;

    const newMappings = { ...customMappings };
    const newHistory = { ...mappingHistory };

    if (costHead && costHead !== 'none') {
      // Extract laborCode from current mapping for history
      const currentLaborCode = typeof currentMapping === 'object' ? currentMapping?.laborCode : currentMapping;
      
      newMappings[systemLower] = { laborCode: costHead };
      newHistory[systemLower] = [
        ...history,
        {
          timestamp: new Date().toISOString(),
          user: userName,
          from: currentLaborCode || originalAutoSuggested,
          to: costHead,
          reason: currentLaborCode ? 'Manual change' : 'Initial assignment'
        }
      ];
      
      // Persist to database if project exists (with auto-suggestion preserved)
      if (currentProject?.id) {
        saveMapping.mutate({
          projectId: currentProject.id,
          systemName: system,
          costHead: `|${costHead}`, // Store as "|laborCode" format
          previousCode: currentLaborCode,
          autoSuggested: originalAutoSuggested
        });
      }
      
      // Store auto-suggestion locally if not already set
      if (!systemAutoSuggestions[systemLower]) {
        setSystemAutoSuggestions(prev => ({
          ...prev,
          [systemLower]: originalAutoSuggested
        }));
      }
    } else {
      const currentLaborCode = typeof currentMapping === 'object' ? currentMapping?.laborCode : currentMapping;
      delete newMappings[systemLower];
      newHistory[systemLower] = [
        ...history,
        {
          timestamp: new Date().toISOString(),
          user: userName,
          from: currentLaborCode || originalAutoSuggested,
          to: originalAutoSuggested,
          reason: 'Reset to auto-detection'
        }
      ];
    }

    setCustomMappings(newMappings);
    setMappingHistory(newHistory);
    showNotification(`Updated mapping: ${system} → ${costHead === 'none' ? originalAutoSuggested : costHead}`, 'success');
  };

  // Create project info for export - defined as a regular function (not a hook) since it's after conditional returns
  const getProjectInfo = (): ProjectInfo => ({
    jobNumber: currentProject?.name || 'Estimate',
    jobName: currentProject?.name || 'Estimate',
    date: new Date(),
    preparedBy: user?.email || 'User',
  });

  // Calculate stats - actuallyMissingCodes is now computed before conditional returns

  // Calculate stats
  const stats = {
    totalItems: filteredData.length,
    codedItems: filteredData.filter(item => item.costCode).length,
    totalHours: filteredData.reduce((sum, item) => sum + (item.hours || 0), 0),
    // FIX: Only count UNASSIGNED items with high-confidence suggestions
    autoMatched: filteredData.filter(item => 
      !item.costCode && // No code assigned yet
      item.suggestedCode && 
      item.suggestedCode.confidence >= 0.8
    ).length,
    codingPercentage: filteredData.length > 0
      ? Math.round((filteredData.filter(item => item.costCode).length / filteredData.length) * 100)
      : 0,
    totalCodes: getTotalCodes()
  };

  // Get unique filter values
  const getUniqueValues = (field) => {
    return [...new Set(estimateData.map(item => item[field]))].filter(Boolean).sort();
  };

  const uniqueSystems = [...new Set(estimateData.map(item => item.system))].filter(Boolean).sort();

  // Filter cost codes for browser
  const getFilteredCodes = () => {
    let allCodes = [];

    Object.entries(STANDARD_COST_CODES).forEach(([categoryName, categories]) => {
      if (!selectedCategory || selectedCategory === categoryName) {
        Object.entries(categories).forEach(([subcatName, codes]) => {
          if (!selectedSubCategory || selectedSubCategory === subcatName) {
            codes.forEach(code => {
              allCodes.push({
                ...code,
                category: categoryName,
                subcategory: subcatName
              });
            });
          }
        });
      }
    });

    // Apply search filters
    if (browserSearchTerm) {
      allCodes = allCodes.filter(code => 
        code.code.toLowerCase().includes(browserSearchTerm.toLowerCase())
      );
    }

    if (browserDescSearch) {
      allCodes = allCodes.filter(code => 
        code.description.toLowerCase().includes(browserDescSearch.toLowerCase())
      );
    }

    return allCodes;
  };

  // Multi-file support handlers
  const handleAppendData = async (items: any[], fileName: string) => {
    if (!currentProject) return;
    
    await appendEstimateItems.mutateAsync({
      projectId: currentProject.id,
      items: items,
      sourceFile: fileName
    });
    
    // Refresh the items from database
    queryClient.invalidateQueries({ queryKey: ['estimate-items', currentProject.id] });
    
    showNotification(`Added ${items.length.toLocaleString()} items from ${fileName}`, 'success');
  };

  const handleReplaceData = async (items: any[], fileName: string) => {
    if (!currentProject) return;
    
    // Transform items to match expected format
    const transformedItems = items.map((item, index) => ({
      ...item,
      id: index,
      suggestedCode: generateCostCode(item)
    }));
    
    setEstimateData(transformedItems);
    setFilteredData(transformedItems);
    
    // Save to database using the mutation
    const itemsToSave = transformedItems.map((item, index) => ({
      row_number: index + 1,
      drawing: item.drawing || '',
      system: item.system || '',
      floor: item.floor || '',
      zone: item.zone || '',
      symbol: item.symbol || '',
      estimator: item.estimator || '',
      material_spec: item.materialSpec || '',
      item_type: item.itemType || '',
      report_cat: item.reportCat || '',
      trade: item.trade || '',
      material_desc: item.materialDesc || '',
      item_name: item.itemName || '',
      size: item.size || '',
      quantity: item.quantity || 0,
      list_price: item.listPrice || 0,
      material_dollars: item.materialDollars || 0,
      weight: item.weight || 0,
      hours: item.hours || 0,
      labor_dollars: item.laborDollars || 0,
      cost_code: item.costCode || '',
      material_cost_code: item.materialCostCode || '',
      source_file: fileName
    }));
    
    await saveEstimateItems.mutateAsync({
      projectId: currentProject.id,
      items: itemsToSave
    });
    
    // Update project file name
    updateProject.mutate({
      id: currentProject.id,
      file_name: fileName,
      total_items: transformedItems.length
    });
    
    showNotification(`Replaced data with ${items.length.toLocaleString()} items from ${fileName}`, 'success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            🔧 Plumbing Estimate Cost Code Manager
          </h1>
          <p className="mt-2 opacity-90">SEC-ACT-COST HEAD Automation System | {stats.totalCodes} Total Codes Available</p>
          {fileName && (
            <div className="mt-4 bg-white/20 px-4 py-2 rounded-lg inline-block">
              <span className="text-sm opacity-90">Project: </span>
              <span className="font-semibold">{fileName.replace(/\.[^/.]+$/, '')}</span>
              <span className="ml-6 text-sm opacity-90">Items: </span>
              <span className="font-semibold">{estimateData.length}</span>
            </div>
          )}
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4">
              <div className="text-center">
                <div className="text-4xl mb-4">⚙️</div>
                <h3 className="text-xl font-semibold mb-4">{loadingMessage}</h3>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300 relative overflow-hidden"
                    style={{ width: `${loadingProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-pulse"></div>
                  </div>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{loadingProgress}%</span>
                  <span>{estimatedTime}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-40 ${
            notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          } text-white`}>
            {notification.message}
          </div>
        )}

        {/* Project Selector */}
        <ProjectSelector
          currentProjectId={currentProject?.id || null}
          onSelectProject={(project) => {
            setCurrentProject(project);
            if (!project) {
              // Clear data when no project selected
              setEstimateData([]);
              setFilteredData([]);
              setCustomMappings({});
              setVerifiedSystems({});
            }
          }}
          onNewProject={() => {
            setEstimateData([]);
            setFilteredData([]);
            setCustomMappings({});
            setVerifiedSystems({});
            setActiveTab('upload');
          }}
        />

        {/* Tabs */}
        <div className="flex border-b bg-gray-50 items-center">
          {['upload', 'estimates', 'mapping', 'material-mapping', 'budget', 'rules'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 font-medium transition-all ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'upload' && '📁 Upload'}
              {tab === 'estimates' && '📊 Estimates'}
              {tab === 'mapping' && '🔗 Labor Mapping'}
              {tab === 'material-mapping' && '📦 Material Mapping'}
              {tab === 'budget' && '💰 Budget Builder'}
              {tab === 'rules' && '🤖 Rules'}
            </button>
          ))}
          
          {/* Add File Button - only show when project has data */}
          {currentProject && estimateData.length > 0 && (
            <button
              onClick={() => setShowAddFileDialog(true)}
              className="ml-auto mr-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm font-medium transition-all"
            >
              <span>➕</span>
              Add File
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* Warning Banner - Show when project has existing data */}
              {currentProject && estimateData.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <span className="text-amber-600 text-xl flex-shrink-0">⚠️</span>
                  <div className="flex-1">
                    <p className="font-medium text-amber-800">
                      This project already has {estimateData.length.toLocaleString()} items loaded
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      Uploading a new file will ask if you want to <strong>add to</strong> or <strong>replace</strong> the existing data.
                      To safely add another file, you can also use the{' '}
                      <button 
                        onClick={() => setShowAddFileDialog(true)}
                        className="text-purple-600 font-medium underline hover:text-purple-800"
                      >
                        Add File
                      </button>{' '}
                      button.
                    </p>
                  </div>
                </div>
              )}
              
              <div
                className="border-3 border-dashed border-blue-400 rounded-xl p-16 text-center cursor-pointer hover:bg-blue-50 transition-all bg-gradient-to-br from-blue-50 to-indigo-50"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
              >
                <div className="text-6xl mb-4">📁</div>
                <h2 className="text-2xl font-semibold mb-2 text-blue-900">Upload Your Estimate File</h2>
                <p className="text-gray-600">
                  Drag & drop your Excel file here or click to browse<br/>
                  <small className="text-gray-500">Supports .xlsx, .xlsm, and .xls files</small>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xlsm,.xls"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Estimates Tab */}
          {activeTab === 'estimates' && estimateData.length > 0 && (
            <>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
                  <h3 className="text-sm text-blue-600 font-medium uppercase">Total Items</h3>
                  <div className="text-3xl font-bold text-blue-900">{stats.totalItems}</div>
                  <p className="text-xs text-blue-600 mt-1">Estimate line items</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
                  <h3 className="text-sm text-green-600 font-medium uppercase">Coded Items</h3>
                  <div className="text-3xl font-bold text-green-900">{stats.codedItems}</div>
                  <p className="text-xs text-green-600 mt-1">{stats.codingPercentage}% complete</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg">
                  <h3 className="text-sm text-purple-600 font-medium uppercase">Total Hours</h3>
                  <div className="text-3xl font-bold text-purple-900">
                    {isNaN(stats.totalHours) ? '0' : stats.totalHours.toFixed(1)}
                  </div>
                  <p className="text-xs text-purple-600 mt-1">Labor hours</p>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-lg">
                  <h3 className="text-sm text-amber-600 font-medium uppercase">Ready to Auto-Assign</h3>
                  <div className="text-3xl font-bold text-amber-900">{stats.autoMatched}</div>
                  <p className="text-xs text-amber-600 mt-1">
                    {stats.autoMatched > 0 ? 'High-confidence suggestions' : 'All items coded'}
                  </p>
                </div>
              </div>

              {/* Source File Audit Summary */}
              <SourceFileSummary 
                items={estimateData} 
                projectId={currentProject?.id} 
              />

              {/* Filters with Search */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <select
                  value={filters.floor}
                  onChange={(e) => setFilters({...filters, floor: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Floors</option>
                  {getUniqueValues('floor').map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
                <select
                  value={filters.system}
                  onChange={(e) => setFilters({...filters, system: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Systems</option>
                  {getUniqueValues('system').map(val => (
                    <option key={val} value={val}>{val}</option>
                  ))}
                </select>
                <select
                  value={filters.costCode}
                  onChange={(e) => setFilters({...filters, costCode: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Codes</option>
                  <option value="unassigned">⚠️ Unassigned Only</option>
                </select>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    setFilters({ floor: 'all', system: 'all', costCode: 'all', search: '' });
                    clearAllColumnFilters();
                  }}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                >
                  Clear Filters
                  {Object.keys(columnFilters).length > 0 && (
                    <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {Object.keys(columnFilters).length}
                    </span>
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mb-6 flex-wrap items-center">
                <button
                  onClick={autoAssignCostCodes}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center gap-2 font-medium"
                >
                  🤖 Auto-Assign All Codes
                </button>
                {/* IMPORTANT: Always use estimateData (all items), NOT filteredData */}
                {/* UI filters are for display only - exports must include everything */}
                <ExportDropdown
                  items={estimateData}
                  projectInfo={getProjectInfo()}
                  laborRate={bidLaborRate}
                  budgetAdjustments={budgetAdjustments}
                  disabled={estimateData.length === 0}
                  floorMappings={floorSectionMap}
                />
                <button
                  onClick={() => setShowCostCodeBrowser(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all flex items-center gap-2 font-medium"
                >
                  🔍 Search All {stats.totalCodes} Cost Codes
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all flex items-center gap-2 font-medium"
                >
                  📁 New File
                </button>
                <ColumnConfigPanel
                  columns={columns}
                  onToggleColumn={toggleColumn}
                  onReset={resetToDefaults}
                />
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-lg shadow-sm border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {visibleColumns.map(col => (
                        <th key={col.key} className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider min-w-[100px]">
                          <ColumnFilterDropdown
                            columnKey={col.key}
                            columnLabel={col.label}
                            data={estimateData}
                            activeFilters={columnFilters}
                            sortConfig={sortConfig}
                            onFilterChange={handleColumnFilterChange}
                            onSortChange={handleSortChange}
                          />
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      const totalPages = Math.ceil(filteredData.length / itemsPerPage);
                      const paginatedData = filteredData.slice(
                        (currentPage - 1) * itemsPerPage,
                        currentPage * itemsPerPage
                      );
                      return paginatedData;
                    })().map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        {visibleColumns.map(col => {
                          const value = item[col.key];
                          // Special rendering for cost code column
                          if (col.key === 'costCode') {
                            return (
                              <td key={col.key} className="px-4 py-3 text-sm">
                                {item.costCode ? (
                                  <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 font-mono font-semibold">
                                    {item.costCode}
                                  </span>
                                ) : item.suggestedCode ? (
                                  <span 
                                    className={`px-2 py-1 text-xs rounded font-mono cursor-pointer transition-all hover:scale-105 ${
                                      item.suggestedCode.confidence >= 0.8 
                                        ? 'bg-green-100 text-green-800'
                                        : item.suggestedCode.confidence >= 0.6
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                    onClick={() => {
                                      const updated = estimateData.map(e => 
                                        e.id === item.id ? {...e, costCode: item.suggestedCode.code} : e
                                      );
                                      setEstimateData(updated);
                                    }}
                                  >
                                    {item.suggestedCode.code}
                                    <span className="ml-1 text-xs opacity-75">
                                      ({Math.round(item.suggestedCode.confidence * 100)}%)
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-red-500 text-xs">No match</span>
                                )}
                              </td>
                            );
                          }
                          // Format numbers
                          if (['quantity', 'hours', 'materialDollars', 'laborDollars', 'listPrice', 'weight'].includes(col.key)) {
                            const numVal = typeof value === 'number' ? value : 0;
                            return (
                              <td key={col.key} className="px-4 py-3 text-sm font-semibold tabular-nums">
                                {['materialDollars', 'laborDollars', 'listPrice'].includes(col.key) 
                                  ? `$${numVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                                  : numVal.toFixed(2)}
                              </td>
                            );
                          }
                          // Truncate long text for material desc
                          if (col.key === 'materialDesc') {
                            const strVal = String(value || '');
                            return (
                              <td key={col.key} className="px-4 py-3 text-sm" title={strVal}>
                                {strVal.substring(0, 40)}{strVal.length > 40 ? '...' : ''}
                              </td>
                            );
                          }
                          // Default rendering
                          return (
                            <td key={col.key} className="px-4 py-3 text-sm">
                              {value ?? '-'}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-sm">
                          {!item.costCode && item.suggestedCode && (
                            <button
                              onClick={() => {
                                const updated = estimateData.map(e => 
                                  e.id === item.id ? {...e, costCode: item.suggestedCode.code} : e
                                );
                                setEstimateData(updated);
                              }}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-all"
                            >
                              Assign
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(() => {
                  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
                  const startItem = filteredData.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0;
                  const endItem = Math.min(currentPage * itemsPerPage, filteredData.length);
                  
                  return (
                    <div className="p-4 border-t bg-gray-50">
                      {/* Top row: Summary and Items Per Page */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm text-gray-600">
                          Showing <span className="font-medium text-gray-900">{startItem}-{endItem}</span> of{' '}
                          <span className="font-medium text-gray-900">{filteredData.length}</span> items
                          {filteredData.length !== estimateData.length && (
                            <span className="text-yellow-600 ml-2">
                              (filtered from {estimateData.length} total)
                            </span>
                          )}
                        </div>
                        
                        {/* Items Per Page Selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Items per page:</span>
                          <select
                            value={itemsPerPage}
                            onChange={(e) => {
                              setItemsPerPage(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                            className="bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                          >
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={250}>250</option>
                            <option value={500}>500</option>
                            <option value={1000}>1000</option>
                          </select>
                        </div>
                      </div>
                      
                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            ⏮ First
                          </button>
                          
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            ← Prev
                          </button>
                          
                          <div className="flex items-center gap-2 mx-2">
                            <span className="text-sm text-gray-500">Page</span>
                            <input
                              type="number"
                              min={1}
                              max={totalPages}
                              value={currentPage}
                              onChange={(e) => {
                                const page = parseInt(e.target.value);
                                if (page >= 1 && page <= totalPages) {
                                  setCurrentPage(page);
                                }
                              }}
                              onBlur={(e) => {
                                const page = parseInt(e.target.value);
                                if (isNaN(page) || page < 1) {
                                  setCurrentPage(1);
                                } else if (page > totalPages) {
                                  setCurrentPage(totalPages);
                                }
                              }}
                              className="w-16 bg-white border border-gray-300 rounded px-2 py-1 text-sm text-center focus:border-blue-500 focus:outline-none"
                            />
                            <span className="text-sm text-gray-500">of {totalPages}</span>
                          </div>
                          
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Next →
                          </button>
                          
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Last ⏭
                          </button>
                        </div>
                      )}
                      
                      {/* Active Filters Display */}
                      {(Object.keys(columnFilters).length > 0 || sortConfig) && (
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                          {Object.keys(columnFilters).length > 0 && (
                            <>
                              <span className="text-xs text-gray-500">Active filters:</span>
                              {Object.entries(columnFilters).slice(0, 3).map(([key]) => (
                                <span
                                  key={key}
                                  className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                                >
                                  {columns.find(c => c.key === key)?.label || key}
                                </span>
                              ))}
                              {Object.keys(columnFilters).length > 3 && (
                                <span className="text-xs text-gray-500">+{Object.keys(columnFilters).length - 3} more</span>
                              )}
                              <button
                                onClick={() => {
                                  setColumnFilters({});
                                  setCurrentPage(1);
                                }}
                                className="text-xs text-red-500 hover:text-red-700 ml-2"
                              >
                                Clear all
                              </button>
                            </>
                          )}
                          {sortConfig && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                              Sorted by {columns.find(c => c.key === sortConfig.key)?.label || sortConfig.key} ({sortConfig.direction === 'asc' ? 'A→Z' : 'Z→A'})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </>
          )}

          {/* Mapping Tab - Using Optimized SystemMappingTab */}
          {activeTab === 'mapping' && (
            estimateData.length > 0 ? (
              <SystemMappingTab
                data={estimateData}
                onDataUpdate={setEstimateData}
                onNavigateToEstimates={(systemFilter) => {
                  setFilters(prev => ({ ...prev, system: systemFilter }));
                  setActiveTab('estimates');
                }}
                projectId={currentProject?.id}
                floorSectionMappings={dbFloorMappings}
                systemActivityMappings={dbActivityMappings}
              />
            ) : (
              <div className="bg-card border border-border rounded-lg p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-3xl">🔗</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No Estimate Data Loaded</h3>
                <p className="text-muted-foreground mb-4">
                  Upload an estimate file first to map systems to labor codes.
                </p>
              </div>
            )
          )}

          {/* Material Mapping Tab */}
          {activeTab === 'material-mapping' && (
            estimateData.length > 0 ? (
              <MaterialMappingTab
                data={estimateData}
                onDataUpdate={setEstimateData}
                projectId={currentProject?.id}
              />
            ) : (
              <div className="bg-card border border-border rounded-lg p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-3xl">📦</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No Estimate Data Loaded</h3>
                <p className="text-muted-foreground mb-4">
                  Upload an estimate file first to configure material code rules.
                </p>
                <p className="text-sm text-muted-foreground">
                  Material codes are assigned by Item Type + Material Spec combinations (not by system like labor codes).
                </p>
              </div>
            )
          )}

          {/* Budget Builder Tab */}
          {activeTab === 'budget' && (
            estimateData.length > 0 ? (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">💰 Budget Builder</h2>
                    <p className="text-gray-600 mt-1">Configure tax rates, foreman bonus, and fabrication hour strips</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">Bid Labor Rate:</label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">$</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={bidLaborRateInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setBidLaborRateInput(val);
                            const parsed = parseFloat(val);
                            if (!isNaN(parsed) && parsed > 0) {
                              setBidLaborRate(parsed);
                            }
                          }
                        }}
                        onBlur={() => {
                          const parsed = parseFloat(bidLaborRateInput);
                          if (isNaN(parsed) || parsed <= 0) {
                            setBidLaborRateInput(bidLaborRate.toString());
                          }
                        }}
                        className="w-20 px-3 py-2 font-mono text-right"
                      />
                      <span className="text-gray-500">/hr</span>
                    </div>
                  </div>
                </div>
                
                <BudgetAdjustmentsPanel
                  laborSummary={(() => {
                    const summary: Record<string, { code: string; description: string; fieldHours: number; rate: number }> = {};
                    estimateData.forEach((item: any) => {
                      const rawCostHead = item.costCode || item.laborCostCode;
                      if (!rawCostHead) return;
                      
                      // Parse and clean up the cost code, handling doubled codes like "BG 0000 BG 0000 BGGW"
                      const parts = rawCostHead.trim().split(/\s+/);
                      let costHead: string;
                      let existingSection: string | null = null;
                      let existingActivity: string | null = null;
                      
                      // Detect doubled codes: "BG 0000 BG 0000 BGGW" (parts[0] === parts[2] && parts[1] === parts[3])
                      if (parts.length >= 5 && parts[0] === parts[2] && parts[1] === parts[3]) {
                        // Doubled - extract real values
                        existingSection = parts[0];
                        existingActivity = parts[1];
                        costHead = parts.slice(4).join(' ');
                      } else if (parts.length >= 3) {
                        // Normal format with section/activity
                        existingSection = parts[0];
                        existingActivity = parts[1];
                        costHead = parts.slice(2).join(' ');
                      } else {
                        costHead = rawCostHead;
                      }
                      
                      // Use existing section/activity if present, otherwise derive from floor/system
                      const section = existingSection || getSectionFromFloor(item.floor, dbFloorMappings);
                      const activity = existingActivity || getActivityFromSystem(item.system, dbActivityMappings);
                      const fullCode = `${section} ${activity} ${costHead}`;
                      
                      if (!summary[fullCode]) {
                        const codeInfo = COST_CODES.find(c => c.code === costHead);
                        summary[fullCode] = {
                          code: fullCode,
                          description: codeInfo?.description || costHead,
                          fieldHours: 0,
                          rate: bidLaborRate
                        };
                      }
                      summary[fullCode].fieldHours += item.hours || 0;
                    });
                    return summary;
                  })()}
                  materialSummary={(() => {
                    const summary: Record<string, { code: string; description: string; amount: number }> = {};
                    estimateData.forEach((item: any) => {
                      const code = item.materialCostCode;
                      if (!code) return;
                      if (!summary[code]) {
                        const codeInfo = COST_CODES.find(c => c.code === code);
                        summary[code] = {
                          code,
                          description: codeInfo?.description || code,
                          amount: 0
                        };
                      }
                      summary[code].amount += item.materialDollars || 0;
                    });
                    return summary;
                  })()}
                  bidLaborRate={bidLaborRate}
                  projectId={currentProject?.id || 'default'}
                  onAdjustmentsChange={setBudgetAdjustments}
                />
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-3xl">💰</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No Estimate Data Loaded</h3>
                <p className="text-muted-foreground mb-4">
                  Upload an estimate file first to configure budget adjustments.
                </p>
                <p className="text-sm text-muted-foreground">
                  The Budget Builder allows you to add sales tax, foreman bonus strips, and fabrication hour allocations.
                </p>
              </div>
            )
          )}

          {/* PDF Import Tab */}
          {activeTab === 'pdf-import' && (
            <PdfImportTab 
              projectName={currentProject?.name}
            />
          )}

          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              {/* Cost Code Library Browser */}
              <div className="bg-white rounded-lg border shadow-sm">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Cost Code Library</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Browse and manage all {stats.totalCodes} available cost codes
                  </p>
                </div>
                <div className="p-6">
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search cost codes (try 'SZMC' or 'SEISMIC')..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                    {COST_CODES
                      .filter(code => 
                        code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        code.description.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((code, index) => {
                        const usage = estimateData.filter(item => item.suggestedCode?.costHead === code.code).length;
                        return (
                          <div key={index} className="border rounded-lg p-3 hover:bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-sm font-bold text-blue-600">
                                {code.code}
                              </span>
                              {usage > 0 && (
                                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                  {usage} uses
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-700 mb-2">{code.description}</div>
                            <div className="text-xs text-gray-500">
                              {code.category} › {code.subcategory}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  
                  {searchTerm && COST_CODES.filter(code => 
                    code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    code.description.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-4xl mb-4">🔍</div>
                      <p>No codes found matching "{searchTerm}"</p>
                      <p className="text-sm mt-2">Try searching for "SZMC" or "SEISMIC"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Learned Pattern Management */}
              <PatternManagement />
            </div>
          )}

          {/* Cost Code Browser Modal */}
          {showCostCodeBrowser && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b">
                  <h2 className="text-2xl font-bold">🔍 Cost Code Browser - {getFilteredCodes().length} of {stats.totalCodes} codes</h2>
                  <button
                    onClick={() => setShowCostCodeBrowser(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                {/* Search Controls */}
                <div className="p-4 border-b bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <input
                      type="text"
                      placeholder="Search by code (e.g., SZMC, SEISMIC)"
                      value={browserSearchTerm}
                      onChange={(e) => setBrowserSearchTerm(e.target.value)}
                      className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Search by description"
                      value={browserDescSearch}
                      onChange={(e) => setBrowserDescSearch(e.target.value)}
                      className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Categories</option>
                      {Object.keys(STANDARD_COST_CODES).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        setBrowserSearchTerm('');
                        setBrowserDescSearch('');
                        setSelectedCategory('');
                        setSelectedSubCategory('');
                      }}
                      className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      Clear All
                    </button>
                  </div>
                  {browserSearchTerm && (
                    <div className="text-sm text-blue-600">
                      💡 Searching for "{browserSearchTerm}" - Try "SZMC" or "SEISMIC" to find seismic codes
                    </div>
                  )}
                </div>

                {/* Results */}
                <div className="p-6 max-h-96 overflow-y-auto">
                  <div className="grid grid-cols-1 gap-3">
                    {getFilteredCodes().map((code, index) => (
                      <div key={index} className="p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {code.code}
                            </span>
                            <span className="font-medium">{code.description}</span>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                              {code.category} › {code.subcategory}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">{code.units}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {getFilteredCodes().length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-4xl mb-4">🔍</div>
                      <p>No codes found matching your search criteria</p>
                      <p className="text-sm mt-2">Try searching for "SZMC" or "SEISMIC" to find seismic codes</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}


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
      </div>
    </div>
  );
};

export default EnhancedCostCodeManager;