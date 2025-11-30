import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { MappingCombobox } from '@/components/MappingCombobox';
import { ProjectSelector } from '@/components/ProjectSelector';
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
  EstimateProject
} from '@/hooks/useEstimateProjects';
import { useAuth } from '@/hooks/useAuth';
import { Auth } from '@/components/Auth';
import { useCostCodes } from '@/hooks/useCostCodes';
import { findBestMatch, findMatchesForSystems } from '@/utils/smartCodeMatcher';
import { useColumnConfig } from '@/hooks/useColumnConfig';
import { ColumnConfigPanel } from '@/components/ColumnConfigPanel';
import { Switch } from '@/components/ui/switch';

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

// Missing codes that should be in the library
const MISSING_CODES = [
  { code: 'REBAR', description: 'REINFORCING STEEL', category: 'STRUCTURAL', sheet: 'Field Labor', units: 'LBS' },
  { code: 'COMPACT', description: 'COMPACTION', category: 'UNDERGROUND', sheet: 'Field Labor', units: 'HRS' },
  { code: 'QUAL', description: 'QUALITY CONTROL', category: 'TESTING', sheet: 'Field Labor', units: 'HRS' },
  { code: 'CEIL', description: 'CEILING WORK', category: 'FINISHING', sheet: 'Field Labor', units: 'SF' },
  { code: 'DOOR', description: 'DOORS AND FRAMES', category: 'FINISHING', sheet: 'Field Labor', units: 'EA' },
  { code: 'WIND', description: 'WINDOWS', category: 'FINISHING', sheet: 'Field Labor', units: 'EA' }
];

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

const FLOOR_MAPPING = {
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
  const [customMappings, setCustomMappings] = useState({});
  const [mappingHistory, setMappingHistory] = useState({});
  const [verifiedSystems, setVerifiedSystems] = useState<Record<string, { verifiedAt: string; verifiedBy: string; costHead: string }>>({});
  const [showCostCodeBrowser, setShowCostCodeBrowser] = useState(false);
  const [browserSearchTerm, setBrowserSearchTerm] = useState('');
  const [browserDescSearch, setBrowserDescSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [editingSystem, setEditingSystem] = useState(null);
  const [showMissingCodes, setShowMissingCodes] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef(null);
  
  // Column configuration
  const { columns, visibleColumns, toggleColumn, resetToDefaults } = useColumnConfig();
  
  // Item type mapping state
  const [enableItemTypeMappings, setEnableItemTypeMappings] = useState(false);
  const [itemTypeMappings, setItemTypeMappings] = useState<Record<string, Record<string, { materialCode?: string; laborCode?: string }>>>({});

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
  
  // Fetch cost codes from database for smart matching
  const { data: dbCostCodes = [] } = useCostCodes();

  // Load saved mappings when project changes
  useEffect(() => {
    if (savedMappings.length > 0) {
      const mappings: Record<string, string> = {};
      const verified: Record<string, { verifiedAt: string; verifiedBy: string; costHead: string }> = {};
      
      savedMappings.forEach(m => {
        mappings[m.system_name] = m.cost_head;
        if (m.is_verified) {
          verified[m.system_name] = {
            verifiedAt: m.verified_at || new Date().toISOString(),
            verifiedBy: m.verified_by || 'user',
            costHead: m.cost_head
          };
        }
      });
      
      setCustomMappings(mappings);
      setVerifiedSystems(verified);
    }
  }, [savedMappings]);

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

  // Generate cost code with audit trail - uses smart matching against database codes
  const generateCostCode = useCallback((item) => {
    let section = '01';
    const floorText = (item.floor || '').toLowerCase().trim();

    for (const [code, patterns] of Object.entries(FLOOR_MAPPING)) {
      if (patterns.some(pattern => pattern.test(floorText))) {
        section = code;
        break;
      }
    }

    const activity = '0000';
    const systemLower = (item.system || '').toLowerCase().trim();

    // Priority 1: Check custom mappings (user overrides)
    let costHead = customMappings[systemLower] || null;
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
  }, [customMappings, dbCostCodes]);

  // Load saved items when project changes or savedItems updates
  useEffect(() => {
    if (savedItems.length > 0 && currentProject?.id) {
      // Transform database items to the format used by the UI
      const transformedItems = savedItems.map((item) => ({
        id: item.id,
        drawing: item.drawing || '',
        system: item.system || '',
        floor: item.floor || '',
        zone: item.zone || '',
        materialDesc: item.material_desc || '',
        itemName: item.item_name || '',
        size: item.size || '',
        quantity: item.quantity || 0,
        materialDollars: item.material_dollars || 0,
        hours: item.hours || 0,
        laborDollars: item.labor_dollars || 0,
        costCode: item.cost_code || '',
        suggestedCode: generateCostCode({
          system: item.system || '',
          floor: item.floor || ''
        })
      }));
      
      setEstimateData(transformedItems);
      setFilteredData(transformedItems);
      setFileName(currentProject.file_name || '');
    }
  }, [savedItems, currentProject?.id, currentProject?.file_name, generateCostCode]);

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
        
        // Create inline Web Worker
        const workerCode = `
          importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
          
          self.onmessage = async function(e) {
            const { data, action } = e.data;
            
            if (action === 'parse') {
              try {
                // Parse Excel file
                self.postMessage({ type: 'progress', progress: 15, message: 'Parsing Excel structure...' });
                
                const workbook = XLSX.read(data, { 
                  type: 'array',
                  cellDates: true,
                  cellNF: true,
                  cellStyles: false
                });
                
                self.postMessage({ type: 'progress', progress: 30, message: 'Finding Raw Data sheet...' });
                
                const sheet = workbook.Sheets['Raw Data'];
                if (!sheet) {
                  throw new Error('Raw Data sheet not found in file. Please ensure your Excel file has a "Raw Data" sheet.');
                }
                
                // Get row count for user info
                const range = XLSX.utils.decode_range(sheet['!ref']);
                const totalRows = range.e.r - range.s.r;
                
                self.postMessage({ 
                  type: 'progress', 
                  progress: 40, 
                  message: \`Found \${totalRows.toLocaleString()} rows. Converting to JSON...\`
                });
                
                // Use native sheet_to_json (fast, optimized, reliable)
                // This will take 15-30 seconds for large files but won't crash
                const startConversion = performance.now();
                const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                const conversionTime = Math.round((performance.now() - startConversion) / 1000);
                
                self.postMessage({ 
                  type: 'progress', 
                  progress: 65, 
                  message: \`Conversion complete in \${conversionTime}s. Preparing to transfer \${jsonData.length.toLocaleString()} rows...\`
                });
                
                // Send data in chunks to avoid memory issues during transfer
                const TRANSFER_CHUNK_SIZE = 100;
                const totalChunks = Math.ceil(jsonData.length / TRANSFER_CHUNK_SIZE);
                
                for (let i = 0; i < jsonData.length; i += TRANSFER_CHUNK_SIZE) {
                  const chunk = jsonData.slice(i, i + TRANSFER_CHUNK_SIZE);
                  const chunkNum = Math.floor(i / TRANSFER_CHUNK_SIZE) + 1;
                  const transferProgress = 65 + Math.round((chunkNum / totalChunks) * 15);
                  
                  self.postMessage({ 
                    type: 'chunk', 
                    chunk: chunk,
                    chunkNumber: chunkNum,
                    totalChunks: totalChunks,
                    totalRows: jsonData.length,
                    progress: transferProgress,
                    message: \`Transferring chunk \${chunkNum.toLocaleString()} of \${totalChunks.toLocaleString()}...\`
                  });
                  
                  // Small yield to keep worker responsive
                  await new Promise(resolve => setTimeout(resolve, 0));
                }
                
                self.postMessage({ 
                  type: 'transfer-complete', 
                  totalRows: jsonData.length,
                  progress: 80,
                  message: \`Successfully transferred \${jsonData.length.toLocaleString()} rows!\`
                });
                
              } catch (error) {
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
            // Helper to detect header rows (rows that contain column header text instead of actual data)
            const isHeaderRow = (row: any): boolean => {
              const drawing = String(row['D'] || row['Drawing'] || '').toLowerCase().trim();
              const system = String(row['D_1'] || row['System'] || '').toLowerCase().trim();
              const floor = String(row['D_2'] || row['Floor'] || '').toLowerCase().trim();
              const materialDesc = String(row['A'] || row['Material Description'] || '').toLowerCase().trim();
              const itemName = String(row['A_1'] || row['Item Name'] || '').toLowerCase().trim();
              
              // Check if this row contains column header text
              const headerKeywords = ['drawing', 'system', 'floor', 'material description', 'item name', 'zone', 'quantity', 'hours'];
              const fieldsToCheck = [drawing, system, floor, materialDesc, itemName];
              
              // If 3 or more fields match header keywords exactly, it's a header row
              const headerMatches = fieldsToCheck.filter(field => 
                headerKeywords.some(keyword => field === keyword)
              ).length;
              
              return headerMatches >= 3;
            };
            
            // Helper to detect empty/summary rows (rows with no identifying info - just totals)
            const isEmptyOrSummaryRow = (row: any): boolean => {
              const system = String(row['D_1'] || row['System'] || '').trim();
              const drawing = String(row['D'] || row['Drawing'] || '').trim();
              const materialDesc = String(row['A'] || row['Material Description'] || '').trim();
              const itemName = String(row['A_1'] || row['Item Name'] || '').trim();
              
              // If ALL key identifier fields are empty, this is a summary/blank row
              // (even if it has dollar values - those are subtotals)
              return !system && !drawing && !materialDesc && !itemName;
            };
            
            // Process chunk immediately, filtering out header rows AND summary/empty rows
            const processedChunk = chunk
              .filter((row: any) => !isHeaderRow(row))
              .filter((row: any) => !isEmptyOrSummaryRow(row))
              .map((row: any, index: number) => ({
                id: processedItemsCount + index,
                drawing: String(row['D'] || row['Drawing'] || ''),
                system: String(row['D_1'] || row['System'] || ''),
                floor: String(row['D_2'] || row['Floor'] || ''),
                zone: String(row['D_3'] || row['Zone'] || ''),
                symbol: String(row['D_4'] || row['Symbol'] || ''),
                estimator: String(row['D_5'] || row['Estimator'] || ''),
                materialSpec: String(row['D_6'] || row['Material Spec'] || ''),
                itemType: String(row['D_7'] || row['Item Type'] || ''),
                reportCat: String(row['D_8'] || row['Report Cat'] || ''),
                trade: String(row['D_9'] || row['Trade'] || ''),
                materialDesc: String(row['A'] || row['Material Description'] || ''),
                itemName: String(row['A_1'] || row['Item Name'] || ''),
                size: String(row['A_2'] || row['Size'] || ''),
                quantity: Number(row['T'] || row['Quantity']) || 0,
                listPrice: Number(row['A_3'] || row['List Price']) || 0,
                materialDollars: Number(row['T_1'] || row['Material Dollars']) || 0,
                weight: Number(row['T_2'] || row['Weight']) || 0,
                hours: Number(row['T_3'] || row['Hours']) || 0,
                laborDollars: Number(row['T_4'] || row['Labor Dollars']) || 0,
                costCode: '',
                suggestedCode: generateCostCode({
                  system: String(row['D_1'] || row['System'] || ''),
                  floor: String(row['D_2'] || row['Floor'] || '')
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
            
            const mappings: Record<string, string> = {};
            const history: Record<string, any[]> = {};
            
            systems.forEach(system => {
              if (system.includes('storm') || system.includes('overflow')) {
                mappings[system] = 'STRM';
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
                  material_desc: item.materialDesc || '',
                  item_name: item.itemName || '',
                  size: item.size || '',
                  quantity: item.quantity || 0,
                  material_dollars: item.materialDollars || 0,
                  hours: item.hours || 0,
                  labor_dollars: item.laborDollars || 0,
                  cost_code: item.costCode || '',
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
              // Update existing project and save items
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

  // Apply filters
  useEffect(() => {
    let filtered = [...estimateData];

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
        item.materialDesc.toLowerCase().includes(search) ||
        item.itemName.toLowerCase().includes(search) ||
        item.drawing.toLowerCase().includes(search)
      );
    }

    setFilteredData(filtered);
  }, [estimateData, filters]);

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

  // Apply mapping to all items of a specific system
  const applyMappingToSystem = (system: string, costHead: string) => {
    const systemLower = system.toLowerCase().trim();
    let assigned = 0;
    
    const updated = estimateData.map(item => {
      if (item.system.toLowerCase().trim() === systemLower && !item.costCode) {
        assigned++;
        return { 
          ...item, 
          costCode: costHead,
          suggestedCode: {
            ...item.suggestedCode,
            code: costHead,
            costHead: costHead,
            source: 'system-mapping'
          }
        };
      }
      return item;
    });

    setEstimateData(updated);
    
    // Persist to database if project exists
    if (currentProject?.id && assigned > 0) {
      batchUpdateSystemCostCodes.mutate({
        projectId: currentProject.id,
        system: system,
        costCode: costHead
      });
    }
    
    showNotification(`Applied ${costHead} to ${assigned} items in ${system}`, 'success');
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
    const autoSuggestion = generateCostCode({ system }).costHead;

    const newMappings = { ...customMappings };
    const newHistory = { ...mappingHistory };

    if (costHead && costHead !== 'none') {
      newMappings[systemLower] = costHead;
      newHistory[systemLower] = [
        ...history,
        {
          timestamp: new Date().toISOString(),
          user: userName,
          from: currentMapping || autoSuggestion,
          to: costHead,
          reason: currentMapping ? 'Manual change' : 'Initial assignment'
        }
      ];
      
      // Persist to database if project exists
      if (currentProject?.id) {
        saveMapping.mutate({
          projectId: currentProject.id,
          systemName: system,
          costHead: costHead,
          previousCode: currentMapping
        });
      }
    } else {
      delete newMappings[systemLower];
      newHistory[systemLower] = [
        ...history,
        {
          timestamp: new Date().toISOString(),
          user: userName,
          from: currentMapping || autoSuggestion,
          to: autoSuggestion,
          reason: 'Reset to auto-detection'
        }
      ];
    }

    setCustomMappings(newMappings);
    setMappingHistory(newHistory);
    showNotification(`Updated mapping: ${system} → ${costHead === 'none' ? autoSuggestion : costHead}`, 'success');
  };

  // Export with cost codes
  const exportWithCostCodes = () => {
    const exportData = filteredData.map(item => ({
      'SEC': item.suggestedCode?.section || '',
      'ACT': item.suggestedCode?.activity || '',
      'COST HEAD': item.suggestedCode?.costHead || '',
      'DESCRIPTION': item.suggestedCode?.description || '',
      'Drawing': item.drawing,
      'System': item.system,
      'Floor': item.floor,
      'Material Description': item.materialDesc,
      'Item Name': item.itemName,
      'Size': item.size,
      'Quantity': item.quantity,
      'Hours': item.hours,
      'Material $': item.materialDollars,
      'Assigned Code': item.costCode || '',
      'Suggested Code': item.suggestedCode?.code || '',
      'Confidence': item.suggestedCode ? Math.round(item.suggestedCode.confidence * 100) + '%' : '',
      'Source': item.suggestedCode?.source || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Labor Report');

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `labor_report_${date}.xlsx`);

    showNotification('Export completed successfully', 'success');
  };

  // Calculate stats
  const stats = {
    totalItems: filteredData.length,
    codedItems: filteredData.filter(item => item.costCode).length,
    totalHours: filteredData.reduce((sum, item) => sum + (item.hours || 0), 0),
    autoMatched: filteredData.filter(item => item.suggestedCode && item.suggestedCode.confidence >= 0.8).length,
    codingPercentage: filteredData.length > 0
      ? Math.round((filteredData.filter(item => item.costCode).length / filteredData.length) * 100)
      : 0,
    totalCodes: getTotalCodes(),
    missingCodes: MISSING_CODES.length
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
        <div className="flex border-b bg-gray-50">
          {['upload', 'estimates', 'mapping', 'rules'].map((tab) => (
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
              {tab === 'mapping' && '🔗 Mapping'}
              {tab === 'rules' && '🤖 Rules'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Upload Tab */}
          {activeTab === 'upload' && (
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
          )}

          {/* Estimates Tab */}
          {activeTab === 'estimates' && estimateData.length > 0 && (
            <>
              {/* Missing Codes Alert */}
              {stats.missingCodes > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⚠️</span>
                      <div>
                        <h3 className="text-lg font-semibold text-red-900">Missing Standard Codes Detected</h3>
                        <p className="text-red-700 text-sm">
                          {stats.missingCodes} critical construction codes are missing from your library. 
                          This may affect project cost tracking accuracy.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowMissingCodes(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      View Missing Codes
                    </button>
                  </div>
                </div>
              )}

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
                  <h3 className="text-sm text-amber-600 font-medium uppercase">Auto-Matched</h3>
                  <div className="text-3xl font-bold text-amber-900">{stats.autoMatched}</div>
                  <p className="text-xs text-amber-600 mt-1">Ready to assign</p>
                </div>
              </div>

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
                  onClick={() => setFilters({ floor: 'all', system: 'all', costCode: 'all', search: '' })}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Clear Filters
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
                <button
                  onClick={exportWithCostCodes}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 font-medium"
                >
                  💾 Export with Codes
                </button>
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
                        <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.slice(0, 100).map((item) => (
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
                {filteredData.length > 100 && (
                  <div className="p-4 bg-gray-50 text-center text-sm text-gray-600">
                    Showing first 100 of {filteredData.length} items
                  </div>
                )}
              </div>
            </>
          )}

          {/* Mapping Tab */}
          {activeTab === 'mapping' && estimateData.length > 0 && (
            <div className="space-y-6">
              {/* System Audit Trail Section */}
              <div className="bg-white rounded-lg border shadow-sm">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">System Mapping Audit Trail</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Track all system mappings and their change history
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600">Item Type Overrides</label>
                    <Switch
                      checked={enableItemTypeMappings}
                      onCheckedChange={setEnableItemTypeMappings}
                    />
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {Object.entries(
                      estimateData.reduce((acc: Record<string, any>, item) => {
                        const system = item.system || 'Unknown';
                        if (!acc[system]) {
                          const systemLower = system.toLowerCase().trim();
                          acc[system] = {
                            count: 0,
                            currentMapping: item.suggestedCode?.costHead || 'SNWV',
                            autoDetected: !customMappings[systemLower],
                            lastChanged: new Date().toISOString(),
                            changeHistory: mappingHistory[systemLower] || [],
                            isVerified: !!verifiedSystems[systemLower],
                            verifiedAt: verifiedSystems[systemLower]?.verifiedAt
                          };
                        }
                        acc[system].count++;
                        return acc;
                      }, {})
                    ).map(([system, data]: [string, any]) => {
                      const systemItems = estimateData.filter(item => (item.system || 'Unknown') === system);
                      return (
                      <div key={system} className={`border rounded-lg p-4 ${data.isVerified ? 'bg-green-50 border-green-300' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            {data.isVerified && (
                              <span className="text-green-600 text-lg">✓</span>
                            )}
                            <span className="font-medium text-gray-900">{system}</span>
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                              {data.count} items
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              data.autoDetected 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {data.autoDetected ? 'Auto-detected' : 'Manual override'}
                            </span>
                            {data.isVerified && (
                              <span className="px-2 py-1 text-xs rounded-full bg-green-600 text-white font-medium">
                                ✓ Verified
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {data.isVerified ? (
                              <button
                                onClick={() => unverifyMapping(system)}
                                className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
                              >
                                Unverify
                              </button>
                            ) : (
                              <button
                                onClick={() => verifyMapping(system, data.currentMapping)}
                                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                              >
                                ✓ Verify Mapping
                              </button>
                            )}
                            <button
                              onClick={() => applyMappingToSystem(system, data.currentMapping)}
                              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-medium"
                            >
                              Apply to System ({data.count})
                            </button>
                            <button
                              onClick={() => updateMapping(system, 'none')}
                              className="px-3 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                            >
                              Reset to Auto
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 text-sm">
                            <span className="text-gray-600">Current mapping:</span>
                            <MappingCombobox
                              value={data.currentMapping}
                              onChange={(value) => updateMapping(system, value)}
                              className="min-w-[250px]"
                            />
                          </div>
                          
                          <div className="text-xs text-gray-500">
                            Last modified: {new Date(data.lastChanged).toLocaleString()}
                            {data.isVerified && (
                              <span className="ml-3 text-green-600">
                                • Verified: {new Date(data.verifiedAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          
                          {/* Breadcrumb trail */}
                          <div className="text-xs text-gray-600 bg-white p-2 rounded border">
                            <span className="font-medium">Change trail:</span>
                            {data.autoDetected ? (
                              <span className="ml-2">Auto-suggested: {data.currentMapping}</span>
                            ) : (
                              <span className="ml-2">
                                Auto-suggested: {autoDetectCostCode(system)} → 
                                <span className="text-blue-600 font-medium"> Changed by user to: {data.currentMapping}</span>
                              </span>
                            )}
                          </div>

                          {/* Item Type Breakdown - shown when toggle is enabled */}
                          {enableItemTypeMappings && (() => {
                            const itemTypeGroups = systemItems.reduce((acc: Record<string, any[]>, item) => {
                              const itemType = item.itemType || 'Other';
                              if (!acc[itemType]) acc[itemType] = [];
                              acc[itemType].push(item);
                              return acc;
                            }, {});
                            
                            const itemTypes = Object.keys(itemTypeGroups);
                            if (itemTypes.length <= 1) return null;
                            
                            return (
                              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="text-sm font-medium text-blue-900 mb-2">
                                  📋 Item Type Overrides ({itemTypes.length} types)
                                </div>
                                <div className="space-y-2">
                                  {itemTypes.map(itemType => {
                                    const items = itemTypeGroups[itemType];
                                    const currentOverride = itemTypeMappings[system]?.[itemType];
                                    return (
                                      <div key={itemType} className="flex items-center justify-between bg-white p-2 rounded border">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium text-gray-700">{itemType}</span>
                                          <span className="text-xs text-gray-500">({items.length} items)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <MappingCombobox
                                            value={currentOverride?.laborCode || ''}
                                            onChange={(value) => {
                                              setItemTypeMappings(prev => ({
                                                ...prev,
                                                [system]: {
                                                  ...prev[system],
                                                  [itemType]: {
                                                    ...prev[system]?.[itemType],
                                                    laborCode: value
                                                  }
                                                }
                                              }));
                                            }}
                                            className="min-w-[180px]"
                                          />
                                          {currentOverride?.laborCode && (
                                            <button
                                              onClick={() => {
                                                // Apply this item type override
                                                const updated = estimateData.map(e => {
                                                  if ((e.system || 'Unknown') === system && (e.itemType || 'Other') === itemType && !e.costCode) {
                                                    return { ...e, costCode: currentOverride.laborCode };
                                                  }
                                                  return e;
                                                });
                                                setEstimateData(updated);
                                                setNotification({ type: 'success', message: `Applied ${currentOverride.laborCode} to ${items.length} ${itemType} items in ${system}` });
                                                setTimeout(() => setNotification(null), 3000);
                                              }}
                                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                            >
                                              Apply
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Item Preview Section */}
                          <details className="mt-3">
                            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2">
                              <span>👁️ Preview Items ({systemItems.length})</span>
                            </summary>
                            <div className="mt-2 border rounded-lg overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="text-left p-2 font-medium">Drawing</th>
                                    <th className="text-left p-2 font-medium">Material Desc</th>
                                    <th className="text-left p-2 font-medium">Item Name</th>
                                    <th className="text-right p-2 font-medium">Qty</th>
                                    <th className="text-right p-2 font-medium">$ Value</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {systemItems.slice(0, 5).map((item, idx) => (
                                    <tr key={item.id || idx} className="bg-white">
                                      <td className="p-2 truncate max-w-[80px]" title={item.drawing}>{item.drawing || '-'}</td>
                                      <td className="p-2 truncate max-w-[150px]" title={item.materialDesc}>{item.materialDesc || '-'}</td>
                                      <td className="p-2 truncate max-w-[120px]" title={item.itemName}>{item.itemName || '-'}</td>
                                      <td className="p-2 text-right tabular-nums">{item.quantity}</td>
                                      <td className="p-2 text-right tabular-nums">${(item.materialDollars || 0).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                  {systemItems.length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="p-4 text-center text-gray-500">
                                        No items found
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                              {systemItems.length > 5 && (
                                <div className="p-2 bg-gray-50 border-t text-center text-xs text-gray-600">
                                  Showing 5 of {systemItems.length} items
                                </div>
                              )}
                              <div className="p-2 bg-gray-50 border-t">
                                <button
                                  onClick={() => {
                                    setFilters(prev => ({ ...prev, system }));
                                    setActiveTab('estimates');
                                  }}
                                  className="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
                                >
                                  ↗️ View All {systemItems.length} Items in Estimates Tab
                                </button>
                              </div>
                            </div>
                          </details>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Mapping Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {Object.keys(verifiedSystems).length}
                  </div>
                  <div className="text-sm text-gray-600">Verified Systems</div>
                </div>
                
                <div className="bg-white rounded-lg border p-4">
                  <div className="text-2xl font-bold text-orange-600">
                    {uniqueSystems.length - Object.keys(verifiedSystems).length}
                  </div>
                  <div className="text-sm text-gray-600">Pending Review</div>
                </div>
                
                <div className="bg-white rounded-lg border p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {Object.keys(customMappings).length}
                  </div>
                  <div className="text-sm text-gray-600">Custom Overrides</div>
                </div>
                
                <div className="bg-white rounded-lg border p-4">
                  <div className="text-2xl font-bold text-purple-600">
                    {uniqueSystems.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Systems</div>
                </div>
              </div>
            </div>
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

              {/* Pattern Rules Management */}
              <div className="bg-white rounded-lg border shadow-sm">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Auto-Detection Pattern Rules</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage how systems are automatically mapped to cost codes
                  </p>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {/* Current Pattern Rules */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Current Pattern Rules</h4>
                      <div className="space-y-2">
                        {Object.entries(DEFAULT_COST_HEAD_MAPPING).map(([code, config]) => (
                          <div key={code} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                            <div>
                              <div className="text-sm font-medium">
                                Patterns: <code className="bg-white px-2 py-1 rounded text-xs">{config.patterns.map(p => p.source).join(', ')}</code>
                                → Maps to: <span className="font-mono text-blue-600">{code}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">{config.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pattern Testing */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-900 mb-3">Test Pattern Matching</h4>
                      <div className="flex space-x-4">
                        <input
                          type="text"
                          placeholder="Enter system description to test (e.g., 'storm drain', 'seismic brace')..."
                          className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                          Test Match
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Usage Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg border p-4">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalCodes}</div>
                  <div className="text-sm text-gray-600">Total Cost Codes</div>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <div className="text-2xl font-bold text-green-600">{Object.keys(DEFAULT_COST_HEAD_MAPPING).length}</div>
                  <div className="text-sm text-gray-600">Pattern Rules</div>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <div className="text-2xl font-bold text-orange-600">{stats.missingCodes}</div>
                  <div className="text-sm text-gray-600">Missing Codes</div>
                </div>
              </div>
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

          {/* Missing Codes Modal */}
          {showMissingCodes && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4">
                <div className="flex items-center justify-between p-6 border-b">
                  <h2 className="text-2xl font-bold text-red-900">⚠️ Missing Standard Codes</h2>
                  <button
                    onClick={() => setShowMissingCodes(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-6">
                  <p className="text-gray-700 mb-6">
                    The following standard construction codes are missing from your cost code library. 
                    Consider adding these to ensure complete project cost tracking coverage:
                  </p>
                  <div className="space-y-3">
                    {MISSING_CODES.map((code, index) => (
                      <div key={index} className="p-4 border border-red-200 rounded-lg bg-red-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-red-700">{code.code}</span>
                            <span className="ml-3 font-medium">{code.description}</span>
                          </div>
                          <div className="text-right text-sm text-red-600">
                            <div>{code.category}</div>
                            <div>{code.units}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>💡 Recommendation:</strong> Contact your cost accounting team to add these codes to your standard library 
                      to ensure accurate project cost tracking and reporting.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedCostCodeManager;