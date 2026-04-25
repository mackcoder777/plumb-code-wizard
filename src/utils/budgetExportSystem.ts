// Murray Company Budget Export System
// Provides two export types:
// 1. Budget Packet - Aggregated by cost code with Excel formulas
// 2. Audit Report - Detailed line items for internal backup

import * as XLSX from 'xlsx';
import { BudgetAdjustments } from '../components/BudgetAdjustmentsPanel';
import { BuildingSectionMapping, resolveSectionStatic, getSectionFromFloorNullable, ResolutionOptions } from '@/hooks/useBuildingSectionMappings';
import { FloorSectionMapping } from '@/hooks/useFloorSectionMappings';
import { DatasetProfile } from '@/utils/datasetProfiler';

// ============================================
// STATIC DATA — Murray Standard Cost Code Lookup (862 codes from Budget_Packet.xls)
// This array is the authoritative source for the Cost Code Look Up tab in exports.
// Do not modify — sourced directly from the Murray Budget_Packet.xls template.
// ============================================
const COST_CODE_LOOKUP: Array<[string, string]> = [
  ['03RW', '03IN RECLAIM WATER'],
  ['06FL', '6 INCH FUEL LINE'],
  ['10FW', '10 INCH FIREWATER'],
  ['10RW', '10IN RECLAIM WATER'],
  ['10ST', '10IN STORM'],
  ['10SW', '10IN SEWER'],
  ['10WT', '10IN WATER'],
  ['12FL', '12 INCH FUEL LINE'],
  ['12FW', '12 INCH FIREWATER'],
  ['12RW', '12IN RECLAIM WATER'],
  ['12ST', '12IN STORM'],
  ['12SW', '12IN SEWER'],
  ['12WT', '12IN WATER'],
  ['14FL', '14 INCH FUEL LINE'],
  ['14FW', '14IN FIRE WATER'],
  ['14RW', '14IN RECLAIM WATER'],
  ['14WT', '14IN WATER'],
  ['15ST', '15IN STORM'],
  ['15SW', '15IN SEWER'],
  ['16FW', '16IN FIRE WATER'],
  ['16RW', '16IN RECLAIM WATER'],
  ['16ST', '16IN STROM DRAIN'],
  ['16WT', '16IN WATER'],
  ['18FW', '18 INCH FIREWATER'],
  ['18RW', '18IN RECLAIM WATER'],
  ['18ST', '18IN STORM'],
  ['18SW', '18 IN SEWER'],
  ['1GAS', '1IN GAS'],
  ['1WTR', '1IN WATER'],
  ['20FW', '20IN FIRE WATER'],
  ['21ST', '21IN STORM'],
  ['21SW', '21 IN SEWER'],
  ['24FW', '24IN FIRE WATER'],
  ['24RW', '24IN RECLAIM WATER'],
  ['24ST', '24IN STORM'],
  ['24SW', '24IN SEWER'],
  ['24WT', '24IN WATER'],
  ['2GAS', '2IN GAS'],
  ['2RWR', '2IN RECLAIMED WATER'],
  ['2STR', '2IN STORM'],
  ['2SWR', '2IN SEWER'],
  ['2WTR', '2IN WATER'],
  ['30ST', '30IN STORM'],
  ['36ST', '36IN STORM'],
  ['3GAS', '3IN GAS'],
  ['3STR', '3IN STORM'],
  ['3SWR', '3IN SEWER'],
  ['3WTR', '3IN WATER'],
  ['42ST', '42IN STORM'],
  ['48ST', '48IN STORM'],
  ['4FWR', '4IN FIRE WATER'],
  ['4GAS', '4IN GAS LINES'],
  ['4RWR', '4IN RECLAIMED WATER'],
  ['4STR', '4IN STORM'],
  ['4SWR', '4IN SEWER'],
  ['4WTR', '4IN WATER'],
  ['50CD', '50% CDs'],
  ['50DD', '50% DDs'],
  ['54ST', '54IN STORM'],
  ['5GAS', '5IN GAS LINES'],
  ['60ST', '60IN STORM'],
  ['66ST', '66 IN STORM'],
  ['6FWR', '6 INCH FIREWATER'],
  ['6RWR', '6IN RECLAIMED WATER'],
  ['6STR', '6IN STORM'],
  ['6SWR', '6IN SEWER'],
  ['6WTR', '6IN WATER'],
  ['75CD', '75% CDs'],
  ['8FWR', '8IN FIRE WATER'],
  ['8RWR', '8IN RECLAIMED WATER'],
  ['8STR', '8IN STORM'],
  ['8SWR', '8IN SEWER'],
  ['8WTR', '8IN WATER'],
  ['90ST', '90 IN STORM'],
  ['9500', 'MATERIAL'],
  ['9510', 'MAJOR EQUIPMENT'],
  ['9511', 'CAST IRON PIPE & FITTINGS'],
  ['9512', 'COPPER PIPE & FITTINGS'],
  ['9513', 'STEEL PIPE & FITTINGS'],
  ['9514', 'STAINLESS STEEL PIPE & FTGS'],
  ['9515', 'PLASTIC PIPE & FITTINGS'],
  ['9516', 'DUCTILE PIPE & FITTINGS'],
  ['9517', 'RCP PIPE & FITTINGS'],
  ['9518', 'CLAY PIPE & FITTINGS'],
  ['9519', 'SLEEVES & INSERTS'],
  ['9520', 'MATERIALS - OTHER'],
  ['9521', 'HANGERS & SUPPORTS'],
  ['9522', 'DRAINS & CARRIERS'],
  ['9523', 'PIPE I.D. & VALVE TAGS'],
  ['9524', 'VALVES'],
  ['9525', 'FIXTURES'],
  ['9526', 'SPECIALTIES'],
  ['9527', 'SEISMIC'],
  ['9528', 'VACUUM JACKETED PIPING'],
  ['9529', 'FIBERGLASS PIPE & FITTINGS'],
  ['9530', 'SPRING MOUNTS'],
  ['9531', 'GRAVEL ROCK & SAND'],
  ['9532', 'ASPHALT'],
  ['9533', 'CONCRETE & FORMING'],
  ['9534', 'PROCESS HANGERS & SUPPORTS'],
  ['9536', 'PRE INSULATED U/G PIPE FITTING'],
  ['9537', 'BOLT & GASKET SETS'],
  ['9538', 'MICS TANKS'],
  ['9539', 'PRECAST CONCRETE VAULTS'],
  ['9540', 'CONDUIT-WIRE'],
  ['9550', 'PIPE - SEWER'],
  ['9551', 'PIPE - WATER'],
  ['9552', 'PIPE - STORM'],
  ['9553', 'PIPE - GAS'],
  ['9554', 'DRITHERM'],
  ['9560', 'FABRICATED DUCT'],
  ['9561', 'DON\'T USE'],
  ['9562', 'EXHAUST & SUPPLY FANS'],
  ['9563', 'SPLIT SYSTEMS'],
  ['9564', 'AH-RTUsS'],
  ['9565', 'FIRE DAMPERS'],
  ['9566', 'AIR DISTRIBUTION'],
  ['9567', 'REFRIGERATION'],
  ['9568', 'CAV / VAV BOXES'],
  ['9569', 'VFD\'S'],
  ['9570', 'SOUND TRAPS'],
  ['9571', 'WELDED DUCT'],
  ['9572', 'CARBON STEEL DUCT'],
  ['9573', 'STAINLESS STEEL DUCT'],
  ['9574', 'EXHAUST FLUE DUCT'],
  ['9575', 'FLEX DUCT'],
  ['9576', 'MISC SHEET METAL ACCESSORIES'],
  ['9577', 'LINEARS'],
  ['9578', 'LOUVERS'],
  ['9579', 'LAGGING & SHORING'],
  ['95CD', '95% CDs/PLAN CHECK'],
  ['9610', 'O/S EQUIPMENT RENTALS'],
  ['9612', 'SHORING RENTAL'],
  ['9615', 'OWNED EQUIPMENT'],
  ['9616', 'OWNER PURCHASED EQUIPMENT - OPEN A 9700 CODE IF NEEDED'],
  ['9617', 'SURVEY'],
  ['9618', 'PASSIVATION'],
  ['9619', 'PAINTING/STRIPING/SANDBLASTING'],
  ['9620', 'ASPHALT PATCHING'],
  ['9621', 'STARTUP ASSISTANCE'],
  ['9627', 'BALANCING - WATER / AIR'],
  ['9629', 'SIESMIC DESIGN'],
  ['9630', 'SCAFFOLDING'],
  ['9634', 'EXCAVATION AND BACKFILL'],
  ['9638', 'QAQC CONTRACTOR'],
  ['9640', 'TRAFFIC CONTROL'],
  ['9641', 'BACKFLOW CERTIFICATION/TESTING'],
  ['9642', 'CHLORINATION'],
  ['9643', 'MEDICAL/GAS CERTIFICATION'],
  ['9644', 'HOT TAP/LINE STOP/LINE BYPASS'],
  ['9645', 'CONTRACT LABOR - NEEDS DESCRIPTION'],
  ['9646', 'O/S TRUCKING & DUMP FEES'],
  ['9647', 'CORING & SAWCUT'],
  ['9648', 'OWNER OPERATED EQP'],
  ['9649', 'CRANE'],
  ['9650', 'DRAIN CLEANING  CAMERA ETC'],
  ['9652', 'WATER / CHEMICAL TREATMENT'],
  ['9653', 'CLEANING FLUSHING & TEST'],
  ['9654', 'PUMP ALIGNMENT'],
  ['9655', 'NON-DESTRUCTIVE TESTING'],
  ['9656', 'RIGGING & SETTING'],
  ['9657', 'SCANNING'],
  ['9659', 'ENGINEERING & DESIGN - DDG'],
  ['9660', 'CONFINED SPACE MONITORING & RESCUE'],
  ['9661', 'ELECTRICAL WORK'],
  ['9662', 'INSULATION'],
  ['9663', 'CONCRETE PUMPING'],
  ['9664', 'CONTROLS'],
  ['9665', 'SUPPLEMENTAL STEEL'],
  ['9666', 'FIRESTOPPING'],
  ['9667', 'OUTSIDE DETAILING'],
  ['9668', 'LANDSCAPING'],
  ['9669', 'UTILITY CONNECTION'],
  ['9670', 'SHEET METAL - WA'],
  ['9671', 'BORING/DRILLING'],
  ['9672', 'CONSULTING'],
  ['9673', 'DUCT CLEANING'],
  ['9674', 'WATER BALANCE - USE 9627'],
  ['9675', 'EQUIPMENT MAINTENANCE'],
  ['9676', 'SHORING ENGINEERING'],
  ['9677', 'AIR / HYDROVAC SERVICES'],
  ['9678', 'ANALYTICAL TESTING'],
  ['9679', 'REFRIGERANT RECOVERY'],
  ['9680', 'DRYWALL PATCH'],
  ['9690', 'BACKFLOW CERTIFICATION - TIER ONE'],
  ['9691', 'LINE STOPPAGES - TIER ONE'],
  ['9692', 'WARRANTY CALL - TIER ONE'],
  ['9693', 'MISC. SERVICE / REPAIR - TIER ONE'],
  ['9694', 'ASSISTANCE FOR CLIENTS - TIER ONE'],
  ['9720', 'GAS & DIESEL'],
  ['9730', 'CONSUMABLES'],
  ['9732', 'PURGE EQUIPMENT/COMPONENTS'],
  ['9740', 'SMALL TOOLS'],
  ['9741', 'WELDING GASES'],
  ['9742', 'DEWARS & PURGE GASES'],
  ['9800', 'SUB GENERAL - (NEEDS DESCRIPTION)'],
  ['9801', 'SUB - INSULATION'],
  ['9802', 'SUB - FIRE SAFE/STOP'],
  ['9803', 'SUB - CHLORINATION'],
  ['9804', 'SUB - CORING & SAWCUT'],
  ['9805', 'SUB - CONCRETE'],
  ['9806', 'SUB - PAVING'],
  ['9807', 'SUB - BORING/DRILLING'],
  ['9808', 'SUB - CONTROLS'],
  ['9809', 'SUB - ELECTRICAL'],
  ['9810', 'SUB - ENGINEERING / DESIGN'],
  ['9811', 'SUB - OUTSIDE FABRICATION'],
  ['9812', 'SUB - MED-GAS CERTIFICATION'],
  ['9813', 'SUB - PAINTING/STRIPING/SANDBLASTING'],
  ['9814', 'SUB - PASSIVATION'],
  ['9815', 'SUB - RIGGING & SETTING'],
  ['9816', 'SUB - SHEET METAL'],
  ['9817', 'SUB - SURVEYOR'],
  ['9818', 'SUB - LANDSCAPING'],
  ['9819', 'SUB - MECHANICAL'],
  ['9820', 'SUB - PIPE LINING & JACKETING'],
  ['9821', 'SUB - TRAFFIC CONTROL'],
  ['9822', 'SUB - MAINTENANCE AGREEMENT'],
  ['9823', 'SUB - WATER / CHEMICAL TREATMENT'],
  ['9825', 'SUB - ABATEMENT'],
  ['9826', 'SUB - SUPPLEMENTAL STEEL'],
  ['9827', 'SUB - BALANCING - WATER / AIR'],
  ['9828', 'SUB - HOT TAPS'],
  ['9829', 'SUB - SEISMIC DESIGN'],
  ['9830', 'SUB - SCAFFOLDING'],
  ['9831', 'SUB - CHEMICAL TREATMENT - CLOSE USE 9823'],
  ['9832', 'SUB - CATHODIC PROTECTION'],
  ['9833', 'SUB - CRANE'],
  ['9834', 'SUB - EXCAVATION & BACKFILL'],
  ['9835', 'SUB - NON-DESTRUCTIVE TESTING'],
  ['9836', 'SUB - CLEANING FLUSHING & TEST'],
  ['9837', 'SUB - DEMO'],
  ['9838', 'SUB - QAQC'],
  ['9840', 'SUB - OWNER OPERATED EQUIPMENT'],
  ['9841', 'SUB - ANALYTICAL TESTING'],
  ['9842', 'SUB - FIRE SPRINKLER'],
  ['9843', 'SUB - DRYWELL INSTALLATION'],
  ['9844', 'SUB - EQUIPMENT REPAIR'],
  ['9846', 'SUB - HARDSCAPE'],
  ['9847', 'SUB - ROOFING'],
  ['9848', 'SUB - DUCT CLEANING'],
  ['9849', 'SUB - OUTSIDE DETAILING - DDG NORCAL'],
  ['9850', 'SUB - BACKFLOW CERTIFICATION/TESTING'],
  ['9851', 'SUB - STARTUP ASSISTANCE'],
  ['9852', 'SUB - SCANNING'],
  ['9853', 'SUB - GROUTING'],
  ['9877', 'SUB - VAC TRUCK'],
  ['99CD', '100% CDs/PLAN CHECK'],
  ['99DD', '100% DDs'],
  ['ABLK', 'ANCHOR BLOCK POURED CONCRETE'],
  ['ACCR', 'ACCRUAL'],
  ['ACID', 'ACID PIPING'],
  ['ACNT', 'SITE ACCOUNTANT'],
  ['ACRM', 'ACP REMOVAL'],
  ['ADIS', 'AIR DISTRIBUTION'],
  ['ADJN', 'ADJUST NOTE'],
  ['ADMN', 'ADMINISTRATIVE ASSISTANT'],
  ['ADRN', 'AREA DRAINS'],
  ['AGCW', 'A.G. COLD WATER'],
  ['AGWV', 'A.G. WASTE & VENT'],
  ['AHCH', 'AIR HANDLER CHILLED WATER'],
  ['AHHR', 'AIR HANDLER HEAT RECOVERY'],
  ['AHRT', 'AH-RTUs'],
  ['AIRP', 'AIR PIPING'],
  ['AL6N', 'AL6XN PIPING'],
  ['ALMP', 'SET ALARM PANELS'],
  ['ALOW', 'ALLOWANCE'],
  ['AMON', 'AMMONIA PIPING'],
  ['ANNO', 'ANNOTATION'],
  ['ARGO', 'ARGON'],
  ['ARSV', 'ARSENIC VACUUM'],
  ['ARVL', 'AIR VALVES'],
  ['ARVV', 'AIR VAC VALVE VAULT'],
  ['ASBL', 'AS-BUILTS'],
  ['AWFI', 'ABIENT WATER FOR INJECTION'],
  ['AWST', 'ACID WASTE & VENT'],
  ['BADG', 'BADGING'],
  ['BAIR', 'BREATHING AIR PIPING'],
  ['BASN', 'BASINS'],
  ['BCDW', 'B.G. CONDENSER WATER'],
  ['BCHW', 'B.G. CHILLED WATER'],
  ['BCNT', 'BALANCE OF REMAINDER OF CONTRACT'],
  ['BCVT', 'BOX CULVERT'],
  ['BEAR', 'BEARING AIR'],
  ['BGAW', 'B.G. ACID WASTE'],
  ['BGBW', 'B.G. BRINE WATER'],
  ['BGCA', 'B.G. COMPRESSED AIR'],
  ['BGCI', 'B.G. CAST IRON'],
  ['BGCN', 'B.G. CONDENSATE'],
  ['BGDC', 'B.G. SEWAGE DISCHARGE'],
  ['BGED', 'B.G. EMERGENCY DRAIN'],
  ['BGFO', 'B.G. FUEL OIL'],
  ['BGGW', 'B.G. GREASE WASTE'],
  ['BGLW', 'B.G. LAB WASTE'],
  ['BGMG', 'B.G. MED GAS'],
  ['BGMH', 'B.G. METHANE SYSTEMS'],
  ['BGMV', 'B.G. METHANE VENT'],
  ['BGNG', 'B.G. NATURAL GAS'],
  ['BGNT', 'BELOW GRADE NITROGEN'],
  ['BGPC', 'B.G. PUMPED CONDENSATE'],
  ['BGPD', 'B.G. PUMP DISCHARGE'],
  ['BGPP', 'B.G. WASTE PROCESS PP FUSEAL'],
  ['BGSD', 'B.G. STORM DRAIN'],
  ['BGST', 'B.G. STEAM'],
  ['BGSW', 'B.G. SOFT WATER'],
  ['BGTP', 'B.G. TRAP PRIMERS'],
  ['BGWP', 'B.G. WASTE PROCESS'],
  ['BGWT', 'B.G. WATER'],
  ['BGWV', 'B.G. WASTE & VENT'],
  ['BHHW', 'B.G. HEATING HOT WATER'],
  ['BIMM', 'BIM MANAGER'],
  ['BIOF', 'BIOFILTRATION ROCK/PIPE'],
  ['BLBM', 'BLUEBEAM PROJECT SET UP'],
  ['BLRT', 'BOILER TRIM/BLOWDOWN'],
  ['BLWD', 'BLOWDOWN'],
  ['BOND', 'BONDS & PERMITS'],
  ['BORE', 'BORING'],
  ['BOVV', 'BLOW OFF VALVE VAULT'],
  ['BRAZ', 'BRAZED COPPER'],
  ['BRIN', 'BRINE LINE'],
  ['BSLV', 'B.G. SLEEVES'],
  ['BSSD', 'B.G. SUB SOIL DRAINAGE'],
  ['BULK', 'BULK GASES'],
  ['BUSR', 'SHUTTLE BUS RENTAL'],
  ['BXHF', 'BOILER EXHAUST FLUE'],
  ['CADS', 'CAD/COMPUTER SYSTEM'],
  ['CALC', 'CALCULATIONS'],
  ['CARB', 'CARBON DIOXIDE'],
  ['CARP', 'CARPENTERS'],
  ['CATH', 'CATHODIC PROTECTION'],
  ['CAVC', 'CAV COILS'],
  ['CBST', 'CATCH BASINS & STRUCTURES'],
  ['CCIP', 'CCIP DEDUCT'],
  ['CCNT', 'COMPANY COST CONTINGENCY'],
  ['CDAM', 'CDA MANAGER'],
  ['CDRN', 'CURB DRAIN'],
  ['CDRP', 'CONDENSATE RETURN - POC'],
  ['CDSR', 'CONDENSER WATER'],
  ['CDSS', 'CONDENSER STEAM'],
  ['CDSU', 'CDS UNIT'],
  ['CERT', 'CERTIFICATION'],
  ['CGCS', 'CLEAN GAS CARBON STEEL'],
  ['CHEM', 'CT FILTER TREATMENT PIPE'],
  ['CHLR', 'CHLORINATION'],
  ['CHMF', 'CHEMICAL FEED'],
  ['CHRM', 'CHROME PIPING'],
  ['CIPA', 'CIP ACID'],
  ['CIPB', 'CIP BASE'],
  ['CIPP', 'CLEAN IN PLACE SUPPLY & RETURN'],
  ['CIST', 'CISTERN/SUSMP EQUIPMENT'],
  ['CL2S', 'CHLORINE 2 PIPING'],
  ['CLNP', 'CLEAN UP'],
  ['CLRF', 'CLARIFIERS'],
  ['CLSM', 'CONTROLLED LOW STRENGTH MATERIALS'],
  ['CMNG', 'COORDINATION MANAGER'],
  ['CMRA', 'Camera'],
  ['CMWT', 'CHEMICAL WATER'],
  ['CNTE', 'CONNECT TO EXISTING'],
  ['CNTL', 'CONTROLS'],
  ['COAL', 'CO ALLOWANCE'],
  ['COAT', 'COATING & HOLIDAY TESTING'],
  ['COCN', 'C.O. CONTINGENCY'],
  ['CODE', 'CODE & LABOR BOOKS'],
  ['COE1', 'CO. OWNED'],
  ['COIL', 'INSTALL COIL'],
  ['COMA', 'COMPRESSED AIR'],
  ['COMB', 'COMBINED TRENCH'],
  ['COMM', 'COMMISSIONING'],
  ['COND', 'CONDENSATE'],
  ['CONN', '4 BOLT CONNECTOR'],
  ['CONT', 'CONTINGENCY'],
  ['COOR', 'COORDINATION'],
  ['COPR', 'FAB - COPPER'],
  ['COPY', 'COPY & REPRODUCTION'],
  ['CORE', 'CORING'],
  ['CPCM', 'CPCW MAIN'],
  ['CPCS', 'CPCW SUB MAIN'],
  ['CPCT', 'CPCW TRANSITION'],
  ['CPCW', 'CPCW PIPING'],
  ['CPVC', 'CPVC'],
  ['CRBD', 'CURB DRAINS'],
  ['CRBN', 'CARBON STEEL PIPING'],
  ['CREV', 'CONSTRUCTABILITY REVIEW'],
  ['CSFD', 'FIRE DAMPERS'],
  ['CSTC', 'CLEAN STEAM CONDENSATE'],
  ['CSTF', 'CARBON STEEL TEFLON LINED'],
  ['CSTI', 'CAST IRON FAB'],
  ['CSTM', 'CLEAN STEAM'],
  ['CTEX', 'CONNECT TO EXISTING STORM DRAIN'],
  ['CTRN', 'CLASSROOM TRAINING'],
  ['CUFC', 'SPLIT SYSTEMS'],
  ['CUTC', 'CUT & CAP'],
  ['CV19', 'COVID SICK TIME'],
  ['CWCP', 'CHWs/CHWR Connector Piping'],
  ['CWEQ', 'EQUIPMENT COOLING WATER'],
  ['CWFI', 'COLD WATER FOR INJECTION'],
  ['CWLD', 'WELDER TESTING'],
  ['CWTR', 'CHILLED WATER'],
  ['DADC', 'DESIGN ASSIST/ DESIGN COORDINATION'],
  ['DAMS', 'PLENUM DAMMING'],
  ['DCGS', 'DRAINS  CLOSE OUTS  GRATES'],
  ['DCTE', 'CONNECT TO EXISTING DOMESTIC WATER'],
  ['DDCK', 'DOUBLE DETECTOR CHECKS'],
  ['DEFL', 'EFFLUINT DISCHARGE'],
  ['DELV', 'DELIVERY'],
  ['DEMO', 'DEMO'],
  ['DEMR', 'DETAILING MANAGER'],
  ['DET1', 'DETAILING CHANGE ORDER'],
  ['DETL', 'DETAILING'],
  ['DEXP', 'DIGGING - EXPLORITORY'],
  ['DGAS', 'GAS DETECTION'],
  ['DIWT', 'DEIONIZED WATER'],
  ['DMOB', 'DEMOBILIZATION'],
  ['DRNS', 'DRAINS & FLOOR SINKS'],
  ['DRUG', 'DRUG TESTING'],
  ['DRYW', 'DRYWELL'],
  ['DSEN', 'ENGINEERING/DESIGN'],
  ['DSLG', 'DIGESTED SLUDGE'],
  ['DSMR', 'DESIGN MANAGER'],
  ['DSZM', 'DUCT SIESMIC'],
  ['DTAL', 'DETAILS'],
  ['DTCL', 'DUCT CLEANING'],
  ['DTDT', 'DUCT DETECTOR INSTALLATION'],
  ['DTHS', 'HIGH SIDE DUCT'],
  ['DTLP', 'LOW PRESSURE DUCT (USE DTLS)'],
  ['DTLS', 'LOW SIDE DUCT'],
  ['DTPR', 'DUCT PRESSURE TESTING'],
  ['DTRS', 'DUCT RISER SUPPORTS'],
  ['DUCT', 'DUCT C/O'],
  ['DWTR', 'DOMESTIC WATER'],
  ['DWVV', 'DOMESTIC WATER VALVE VAULT'],
  ['EDRN', 'EMERGENCY DRAIN'],
  ['EFSF', 'EXHAUST FANS'],
  ['ENG1', 'ENGINEERING/DESIGN CHANGE ORDER'],
  ['EQCC', 'COIL CONNECTIONS'],
  ['EQIP', 'EQUIPMENT SCHEDULES'],
  ['EQPD', 'EQUIPMENT PADS'],
  ['ESCT', 'ESCORT'],
  ['ESTM', 'ESTIMATING'],
  ['EWSH', 'EYEWASH STATION'],
  ['EWTR', 'EMERGENCY WATER'],
  ['EXDT', 'EXHAUST DUCT WORK'],
  ['EXHE', 'HEAT EXHAUST DUCT'],
  ['FABP', 'FAB PIPING'],
  ['FACL', 'FACILITIES'],
  ['FBRG', 'FIBER GLASS'],
  ['FCNT', 'FIELD LABOR BONUS CONT'],
  ['FCON', 'STEAM FINAL CONECTORS'],
  ['FCUC', 'FAN COIL UNITS'],
  ['FDFS', 'FLR DRAIN/SINK/CO'],
  ['FDTL', 'FIELD DETAILING'],
  ['FFUS', 'INSTALL FAN FILTER UNIT'],
  ['FHYD', 'FIRE HYDRANT'],
  ['FILL', 'BACKFILL'],
  ['FIRE', 'SITE FIRE LABOR'],
  ['FLAG', 'FLAGGER'],
  ['FLSH', 'CLEAN & FLUSH'],
  ['FLTI', 'FILTER INSTALLATION'],
  ['FLTN', 'FLATTENING'],
  ['FLUE', 'FLUE'],
  ['FMTR', 'FOREMAN TRAINING'],
  ['FNSH', 'FINISH'],
  ['FOAT', 'FACTORY OWNER ACCEPTANCE TEST'],
  ['FOVT', 'FUEL OIL VENT'],
  ['FPLN', 'FLOORPLANS'],
  ['FRGT', 'FRIEGHT'],
  ['FRMN', 'FOREMAN'],
  ['FSLV', 'FAB SLEEVES'],
  ['FTUP', 'FIT UP'],
  ['FUEL', 'FUEL OIL'],
  ['FWTR', 'FIRE WATER'],
  ['FWVV', 'FIRE WATER VALVE VAULT'],
  ['GALC', 'GALVANIZED CIRCULAR'],
  ['GALR', 'GALVANIZED RECTANGULAR'],
  ['GASE', 'GAS EXCAVATE'],
  ['GCNT', 'GC LABOR CONTINGENCY'],
  ['GCON', 'GENERAL CONDITIONS'],
  ['GDCT', 'GREASE DUCT'],
  ['GEN2', 'GENERAL NITROGEN'],
  ['GENX', 'GENERATOR EXHAUST'],
  ['GFHV', 'MECHANICAL PIPING GENERAL FOREMAN'],
  ['GFPL', 'PLUMBING GEN. FOREMAN'],
  ['GFRM', 'GENERAL FOREMAN'],
  ['GFSM', 'SHEET METAL GENERAL FOREMAN'],
  ['GLYC', 'GLYCOL'],
  ['GRAV', 'GRAVITY PIPING'],
  ['GRDS', 'INSTALL GRDS'],
  ['GRSI', 'GREASE INTERCEPTOR'],
  ['GRTG', 'GROUTING'],
  ['GRTX', 'GROSS RECEIPTS TAX (FOR ACCOUNTING USE ONLY)'],
  ['GRWV', 'GREASE WASTE & VENT'],
  ['GSPR', 'GENERAL SUPERINTENDENT'],
  ['HAST', 'HASTELLOY'],
  ['HAUL', 'HAUL OFF'],
  ['HBRS', 'HYDROGEN BROMIDE PIPING'],
  ['HDEX', 'HAND EXCAVATION'],
  ['HDFR', 'SET HOOKS & HUMIDIFIERS'],
  ['HDWL', 'HEADWALLS'],
  ['HEQP', 'HOOK-UP EQUIPMENT'],
  ['HFBS', 'HANGERS FAB SHEETS'],
  ['HHWT', 'HEATING HOT WATER'],
  ['HLCB', 'HELIUM LEAK CHECK BAGS'],
  ['HNGH', 'HANGERS & SUPPORTS - HVAC'],
  ['HNGP', 'HANGERS & SUPPORTS - PLMB'],
  ['HNGS', 'HANGERS & SUPPORTS'],
  ['HNT2', 'HOUSE NITROGEN'],
  ['HOFA', 'HPOFA PIPING'],
  ['HOSE', 'HOSE'],
  ['HOUS', 'HOUSING/SUBSISTENCE/TRAVEL DUES'],
  ['HPEW', 'HPE WATER'],
  ['HPLP', 'HIGH POINT/LOW POINT DRAINS'],
  ['HPN2', 'HIGH PURITY NITROGEN'],
  ['HPNG', 'HIGH PRESSURE NATURAL GAS'],
  ['HPUR', 'HIGH PURITY PIPING'],
  ['HRCN', 'HIGH RISE FACTOR CONTINGENCY'],
  ['HREC', 'HEAT RECOVERY'],
  ['HRSS', 'HARASSMENT TRAINING'],
  ['HSVC', 'HOUSE VACUUM'],
  ['HVST', 'HVAC START AND TEST PREFUNCTIONAL'],
  ['HWCP', 'HOT WATER CONNECTOR PIPING'],
  ['HWFI', 'HOT WATER FOR INJECTION'],
  ['HYDR', 'HYDROGEN'],
  ['HYFP', 'HYDRANT FUEL PIT'],
  ['IFCD', 'ISSUED FOR CONSTRUCTION'],
  ['INDA', 'INDUSTRIAL AIR'],
  ['INDL', 'INDUSTRIAL'],
  ['INDR', 'INDIRECT DRAINS'],
  ['INJR', 'INJURY'],
  ['INRT', 'INERT GAS'],
  ['INSP', 'INSPECTION'],
  ['INST', 'INSTRUMENT AIR'],
  ['INTR', 'INTERNET'],
  ['INVT', 'INVESTIGATION'],
  ['IRRG', 'IRRIGATION PIPING'],
  ['ISVP', 'ISOLATION VALVE PIT'],
  ['ISVV', 'ISOLATION VALVE VAULT'],
  ['ISWT', 'INDUSTRIAL SOFT WATER'],
  ['ITEQ', 'IT COMPUTER EQUIPMENT'],
  ['IWMG', 'INWALL MED GAS'],
  ['IWTR', 'INDUSTRIAL HOT/COLD WATER'],
  ['IWWT', 'INWALL WATER'],
  ['IWWV', 'INWALL WASTE & VENT'],
  ['JFSR', 'JACKET FLUID SUPPY & RETURN'],
  ['JNSS', 'JANITORIAL & SECURITY SERVICE'],
  ['JSTR', 'JUNCTION STRUCTURES'],
  ['KEQU', 'Kitchen Equip Hookup'],
  ['LAB1', 'DO NOT USE!'],
  ['LABR', 'LABORERS'],
  ['LAIR', 'LAB AIR'],
  ['LAYO', 'LAYOUT'],
  ['LCNT', 'LABOR CONTINGENCY'],
  ['LEGL', 'LEGAL'],
  ['LEQP', 'LAB EQUIPMENT'],
  ['LGAS', 'LAB GAS'],
  ['LOIL', 'LUBE OIL'],
  ['LOPR', 'LIFT OPERATOR'],
  ['LOTO', 'LOCK OUT TAG OUT'],
  ['LOUV', 'LOUVERS'],
  ['LPDP', 'LOW POINT DRAIN PIT'],
  ['LPGH', 'LOW PRESSURE GAS HOLDER PIPE'],
  ['LPGS', 'LOW PRESSURE GAS'],
  ['LPO2', 'LPO2 PIPING'],
  ['LPUR', 'LOW PURITY PIPING'],
  ['LRCN', 'LABOR RATE CONTINGENCY'],
  ['LVAC', 'LAB VAC'],
  ['LWST', 'LAB WASTE & VENT'],
  ['MAIN', 'MAIN'],
  ['MAT1', '.'],
  ['MCKM', 'MOCK UP MATERIAL'],
  ['MCNT', 'MATERIAL CONTINGENCY'],
  ['MDGS', 'MEDICAL GASES'],
  ['MDWS', 'MODULAR WETLAND SYSTEMS'],
  ['MECH', 'MECHANICAL PIPING'],
  ['MEDA', 'MEDICAL AIR PIPING'],
  ['MEDI', 'MEDICAL AIR INTAKE'],
  ['MEDP', 'MEDICAL PIPING'],
  ['MEPC', 'MEP COORDINATION'],
  ['MEPM', 'MEP MANAGER'],
  ['MEQU', 'MEDICAL EQUIPMENT HOOKUP'],
  ['METH', 'METHANE'],
  ['MGEQ', 'MED GAS EQUIPMENT'],
  ['MGOH', 'O.H. MEDICAL GAS'],
  ['MHST', 'STORM DRAIN MANHOLES'],
  ['MHSW', 'SEWER MANHOLE'],
  ['MISC', 'MISCELLANEOUS EXPENSES'],
  ['MNGR', 'ENGINEER MNGR FOR ARUP DESIGN'],
  ['MOAT', 'MOAT'],
  ['MOBL', 'MOBILIZATION'],
  ['MOCK', 'MOCK-UP'],
  ['MODL', 'MODELING'],
  ['MODM', 'MOBILIZE / DEMOBILIZE'],
  ['MPGS', 'MEDIUM PRESSURE GAS'],
  ['MREV', 'MATERIAL REVISION'],
  ['MSLB', 'MISCELLANEOUS LABOR'],
  ['MTGS', 'DESIGN MEETINGS'],
  ['MTLH', 'MATERIAL HANDLING'],
  ['MUAD', 'MAKE UP AIR DUCT'],
  ['MVAC', 'MEDICAL VACUUM'],
  ['NGAS', 'NATURAL GAS'],
  ['NITR', 'NITROGEN'],
  ['NPWT', 'NON POTABLE WATER'],
  ['NTGS', 'NITROGEN GAS'],
  ['NTWK', 'NETWORKING'],
  ['OATS', 'OPEREATIONAL ACCEPTANCE TESTING'],
  ['OCIP', 'OCIP'],
  ['OCTN', 'OVERTIME CONTINGENCY'],
  ['ODTL', 'OUTSIDE DETAILING - DDG'],
  ['OENG', 'DON\'T USE'],
  ['OEQM', 'OFFICE EQUIPMENT MAINTENANCE'],
  ['OEQP', 'OFFICE EQUIPMENT/FURNITURE'],
  ['OFAM', 'OFA MAIN'],
  ['OFAP', 'OFA PIPING'],
  ['OFEQ', 'OWNER FURNISHED EQUIPMENT'],
  ['OPRT', 'OPERATORS'],
  ['ORNT', 'ORIENTATION'],
  ['OSHA', 'OSHA 30 TRAINING'],
  ['OSTM', 'OVERHEAD STEAM'],
  ['OTR1', '.'],
  ['OTRN', 'OWNER TRAINING'],
  ['OWST', 'OIL WASTE'],
  ['OXGN', 'OXYGEN'],
  ['OZON', 'OZONE PIPING'],
  ['PARK', 'PARKING'],
  ['PAVE', 'PAVING'],
  ['PCLN', 'PIPE CLEANING/ BEVELING'],
  ['PCMP', 'PAN COMPUTER EQUIPMENT'],
  ['PCST', 'PRE CAST STORM'],
  ['PCSW', 'PRE CAST STORM WATER'],
  ['PCWE', 'PCW PIPING'],
  ['PCWL', 'PCW LATERAL PIPING'],
  ['PCWM', 'PCW MAIN'],
  ['PCWS', 'PCW SUM MAIN SECTOR'],
  ['PCWT', 'PCW TRANSITION'],
  ['PDIT', 'PDIT & PE INSTALLATION'],
  ['PEXX', 'PEX DOMESTIC WATERS'],
  ['PFTR', 'PIPEFITTERS'],
  ['PHOT', 'PHOTOS'],
  ['PIDV', 'PIPE I.D. & VALVE TAGS'],
  ['PIPE', 'MISC. PIPING'],
  ['PLEN', 'BUILT-UP PLENUM FAB.'],
  ['PLMB', 'PLUMBERS'],
  ['PLST', 'PLASTIC PIPING'],
  ['PLTA', 'PLANT AIR'],
  ['PMNG', 'PROJECT MANAGER'],
  ['PMPD', 'PUMP DISCHARGE'],
  ['PMPS', 'PUMP STATION'],
  ['PNCH', 'PUNCH LIST'],
  ['PNTB', 'PNEUMATIC TUBE'],
  ['POCS', 'POINTS OF CONNECTIONS'],
  ['POOL', 'POOL PIPING'],
  ['POST', 'POSTAGE/EXPRESS MAIL'],
  ['POTH', 'POTHOLE/CAP/MOB'],
  ['PRAR', 'PROCESS AIR'],
  ['PRCH', 'PURCHASING BUYER'],
  ['PRCN', 'PRE CONSTRUCTION'],
  ['PRCO', 'PROJECT COORDINATOR'],
  ['PRDP', 'PRODUCT PIPING'],
  ['PRDR', 'PROCESS DRAIN'],
  ['PRES', 'PRESSURE PIPING'],
  ['PREX', 'PROJECT EXECUTIVE'],
  ['PRHT', 'PREHEAT'],
  ['PRJE', 'PROJECT ENGINEER'],
  ['PROC', 'PROCESS'],
  ['PROD', 'PROJECT DIRECTOR'],
  ['PROL', 'PROLOG LICENSING'],
  ['PROP', 'PROPANE'],
  ['PROV', 'PROCESS VENT'],
  ['PRPR', 'PRO-PRESS'],
  ['PTLD', 'POINT LOADING DECKS'],
  ['PTST', 'PRESSURE TESTING'],
  ['PUBR', 'PUBLIC RELATIONS'],
  ['PURG', 'PURGE GASES'],
  ['PURW', 'PURIFIED WATER PIPING'],
  ['PVAC', 'PVAC PIPING'],
  ['PVAM', 'PVAC MAIN'],
  ['PVAS', 'PVAC SUB MAIN'],
  ['QAQC', 'QUALITY ASSURANCE'],
  ['QCHV', 'QUENCH VENT'],
  ['QEQM', 'DON\'T USE'],
  ['RACK', 'RACKS'],
  ['RADF', 'RADIANT FLOORING'],
  ['RAIN', 'RAINSTORE'],
  ['RCLM', 'RECLAIM WATER'],
  ['RDCO', 'RADIO/COMMUNICATION'],
  ['RECD', 'RECTANGLE DUCT WORK'],
  ['REFL', 'REFRIGERANT LINE'],
  ['REFR', 'REFRIGERATION'],
  ['REN1', 'RENTALS'],
  ['REOS', 'REVERSE OSMOSIS'],
  ['REPD', 'Repad Welding'],
  ['RET1', 'RETAINAGE ON JOBS'],
  ['REV1', 'INCOME FROM JOBS'],
  ['REXH', 'REF. EXHAUST'],
  ['RFDT', 'ROOF DUCT'],
  ['RFEQ', 'ROOF EQUIPMENT'],
  ['RFIS', 'DETAILING RFIs'],
  ['RIGG', 'RIGGING PIPE'],
  ['RISR', 'RISERS'],
  ['RNDD', 'ROUND DUCT WORK'],
  ['ROUG', 'Rough In'],
  ['ROWR', 'RO/DI WATER'],
  ['RVLS', 'CLOSE OUT - RAISE VALVES'],
  ['RVLV', 'CLOSE-OUT - RAISE VAVLES MHS'],
  ['RVNT', 'REFRIGERANT VENT'],
  ['RWTR', 'RECLAIMED WATER'],
  ['SAFE', 'SAFETY LABOR'],
  ['SAFT', 'SAFETY TRAINING'],
  ['SBPE', 'SBE PARTICIPATION'],
  ['SCAN', 'SCANNING-DRILLING'],
  ['SCBP', 'SCRUBBER BLOWDOWN PIPING'],
  ['SCDL', 'SCHEDULER W/ HRS'],
  ['SCHD', 'SCHEDULER'],
  ['SCHM', 'SCHEMATIC DESIGN'],
  ['SCRN', 'SCREENINGS IMMUNITY/DRUG'],
  ['SCSP', 'SCRUBBER SOLUTION PIPING'],
  ['SCTR', 'SITE SECRETARY'],
  ['SDCO', 'STORM DRAIN CLEAN OUT'],
  ['SDOH', 'O.H. STORM DRAIN'],
  ['SDRN', 'SYSTEM DRAINDOWN / ISOLATION'],
  ['SDTL', 'SEISMIC DETAILING'],
  ['SDWG', 'SHOW DRAWINGS'],
  ['SEAL', 'SEAL DUCTWORK'],
  ['SENG', 'ENGINEERS STAMP'],
  ['SEQP', 'EQUIPMENT SETTING'],
  ['SEWR', 'SEWER PIPING'],
  ['SFAB', 'SHOP FAB'],
  ['SFCS', 'SAFETY CONSULTANT'],
  ['SFTY', 'SAFETY'],
  ['SGAS', 'SOUR GAS S.S.'],
  ['SGRA', 'STATIC GROUND ROD ASSEMBLY'],
  ['SHFT', 'SHAFT'],
  ['SHTL', 'SHUTTLING'],
  ['SIPP', 'SIPP COORDINATOR'],
  ['SISO', 'SPRING ISOLATORS'],
  ['SITE', 'SITE U.G. PIPING'],
  ['SLVS', 'SLEEVES & INSERTS'],
  ['SMLO', 'LAYOUT - SHEET METAL'],
  ['SMTG', 'ANNUAL SAFETY MEETING'],
  ['SMTL', 'SHEET METAL LABOR'],
  ['SNWV', 'SANITARY WASTE & VENT'],
  ['SOFA', 'SHPOFA PIPING'],
  ['SOFF', 'SAFE OFF AND CAP UP'],
  ['SOLR', 'SOLAR'],
  ['SPCL', 'SPECIALTIES'],
  ['SPEC', 'SPECIFICATIONS'],
  ['SPEP', 'SUMP PUMP EJE PIPING'],
  ['SPGP', 'SPECIALTY GAS PIPING'],
  ['SPLY', 'OFFICE SUPPLIES'],
  ['SPOL', 'SPOOLING'],
  ['SPOT', 'EQUIPMENT SPOTTER'],
  ['SPRT', 'SUPPORTS'],
  ['SPSV', 'SPOOL SURVEY'],
  ['SRBR', 'SUPPLY & RETURN BRANCHES'],
  ['SRMA', 'SUPPLY & RETURN MAINS'],
  ['SRVY', 'SURVEYOR'],
  ['SS10', 'STAINLESS STEEL SCH 10'],
  ['SSCI', 'STAINLESS STEEL CIRCULAR'],
  ['SSCO', 'SEWER CLEANOUTS'],
  ['SSDR', 'SUB - SOIL DRAINAGE'],
  ['SSRC', 'STAINLESS STEEL RECTANGULAR'],
  ['SSTA', 'SOUTHWEST SAFETY TRAINING ALLOW'],
  ['SSTL', 'STAINLESS STEEL PIPING'],
  ['SSTM', 'SITE STORM'],
  ['STEL', 'STEEL'],
  ['STEM', 'STEAM ENCLOSURE'],
  ['STGD', 'STEAM GENERATE DRAIN'],
  ['STGM', 'STEAM GENERATE M/U WATER'],
  ['STIN', 'HANGER STRAP INSERTING & LAYOUT'],
  ['STMC', 'STEAM & CONDENSATE'],
  ['STMG', 'STEAM GENERATE DIST'],
  ['STMP', 'STEAM/STM VENT PIPING'],
  ['STMR', 'STEAM RISERS'],
  ['STMS', 'STEAM TO STERILIZER'],
  ['STMV', 'STEAM VENT'],
  ['STRA', 'STORM TRAP'],
  ['STRE', 'START-UP EQUIPMENT'],
  ['STRM', 'STORM DRAIN'],
  ['STRU', 'JUNCTION STRUCTURES'],
  ['STUB', 'STUB-IN'],
  ['STUP', 'DRAWING UPLOAD/SET UP'],
  ['STVD', 'STEAM VENT DEMO'],
  ['STVP', 'STEAM VENT AT POC'],
  ['STWT', 'SITE WATER'],
  ['SUB1', '.'],
  ['SUBM', 'SUB MAIN'],
  ['SUBS', 'SUBSISTENCE'],
  ['SUMP', 'SUMP PIT'],
  ['SUPP', 'SUPPLEMENTAL STEEL'],
  ['SUPR', 'SUPERINTENDENT'],
  ['SUPT', 'DRAFTING MODEL/DWNG CLEANUP'],
  ['SWEJ', 'SEWAGE EJECTOR DISCHARGE'],
  ['SWFN', 'STORM WATER FILTRATION'],
  ['SWSP', 'SOFTER WATER PIPING'],
  ['SWST', 'SOLVENT WASTE/SUPPLY'],
  ['SWTR', 'SOFT COLD WATER'],
  ['SZMC', 'SEISMIC'],
  ['TANK', 'B.G. TANK INSTALLATION'],
  ['TAPS', 'HOT TAP ASSISTANCE'],
  ['TCHW', 'TERTIARY CHILLED WATER'],
  ['TELE', 'TELEPHONE'],
  ['TEMP', 'TEMPORARY COOLING'],
  ['TEST', 'TESTING'],
  ['TEXT', 'TEXTURA FEES'],
  ['TFLN', 'TEFLON'],
  ['TMPU', 'TEMP UTILITIES'],
  ['TMPW', 'TEMPERED WATER'],
  ['TMUM', 'TEMPORARY UTILITY MATERIAL'],
  ['TNKX', 'TANK EXCAVATION'],
  ['TNLP', 'TUNNEL PIPING'],
  ['TOXG', 'TOXIC GAS'],
  ['TPAC', 'TEMP HVAC'],
  ['TRAP', 'TRAP PRIMERS'],
  ['TRBL', 'TRIMBLE LABOR'],
  ['TRES', 'MAIN TRESTLE'],
  ['TRFC', 'TRAFFIC  FENCE  PLATE MAINT.'],
  ['TRLH', 'TRAILER HOOK-UP'],
  ['TRMB', 'TRIMBLE SURVEYING'],
  ['TRNC', 'TRENCHING'],
  ['TRND', 'TRENCH DRAINS'],
  ['TRNG', 'TRAINING/ DRUG TEST'],
  ['TRPL', 'TRENCH PLATES LABOR'],
  ['TRVL', 'TRAVEL EXPENSES'],
  ['TUBS', 'SET TUBS'],
  ['TUNL', 'TUNNEL'],
  ['TWTR', 'TEMP WATER'],
  ['UCIP', 'UCIP DEDUCT'],
  ['UNGD', 'UNDERGROUND C/O'],
  ['UPLD', 'UPLOAD/DOWNLOAD'],
  ['UPWP', 'ULTRA PRUE WATER PIPING'],
  ['UTGS', 'UTILITY TUNNEL GAS'],
  ['UWTR', 'UTILITY WATER'],
  ['VACA', 'VACATION & HOLIDAY'],
  ['VACP', 'VACUUM PIPING'],
  ['VALT', 'VAULT - CONCRETE SUPPORTS'],
  ['VALV', 'VALVES'],
  ['VAVC', 'VAV COILS'],
  ['VEFY', 'VERIFY FIELD'],
  ['VENT', 'VENTS'],
  ['VEQP', 'EQUIPMENT VENT'],
  ['VHPE', 'VEHICLE PERMITS'],
  ['VSDA', 'VESDA PIPING'],
  ['VUCU', 'VAV DUCTING'],
  ['WATR', 'DOMESTIC & INDUSTRIAL WATER'],
  ['WCTE', 'CONNECT TO EXISTING FIRE WATER'],
  ['WDDT', 'WELDED DUCT'],
  ['WELD', 'WELDING TESTING'],
  ['WETV', 'WET VACUUM'],
  ['WHSP', 'WAREHOUSE PERSONEL'],
  ['WHSR', 'WAREHOUSE RENTAL'],
  ['WLDG', 'WELDING'],
  ['WNTY', 'WARRANTY LABOR'],
  ['WPDR', 'WASTE PROCESS DRAIN FUSEAL'],
  ['WRNT', 'WARRANTY'],
  ['WSTE', 'WASTE PIPING'],
  ['WTCH', 'FIRE WATCH'],
  ['WTOH', 'O.H. DOMESTIC WATER'],
  ['WTRS', 'WATER SYSTEMS'],
  ['WTRT', 'WATER TESTING'],
  ['WVOH', 'O.H. WASTE & VENT'],
  ['XCAV', 'EXCAVATION & BACKFILL'],
  ['XHAU', 'EXHAUST'],
  ['XRAY', 'X-Ray'],
];

// ============================================
// TYPES
// ============================================

export interface FloorSectionMap {
  [floorPattern: string]: string; // floor -> section code (e.g., "Club Level" -> "02")
}

export interface CategoryLaborMap {
  [categoryName: string]: string; // report_cat -> labor code (e.g., "Drains/Cleanouts" -> "DRNS")
}

export interface ExportEstimateItem {
  id: string | number;
  drawing?: string;
  system?: string;
  floor?: string;
  zone?: string;
  materialSpec?: string;
  itemType?: string;
  reportCat?: string; // Added for category-based labor mapping
  trade?: string;
  materialDesc?: string;
  materialDescription?: string;
  itemName?: string;
  size?: string;
  quantity?: number;
  listPrice?: number;
  materialDollars?: number;
  hours?: number;
  laborDollars?: number;
  // Labor cost code components
  laborSec?: string;
  laborAct?: string;
  laborCostHead?: string;
  laborDescription?: string;
  costCode?: string; // Legacy field - maps to laborCostHead
  // Material cost code
  materialCode?: string;
  materialCostCode?: string; // Legacy field - maps to materialCode
  materialCodeDescription?: string;
  // Suggested code info
  suggestedCode?: {
    section?: string;
    activity?: string;
    costHead?: string;
    description?: string;
  };
}

export interface ProjectInfo {
  jobNumber: string;
  jobName: string;
  date: Date;
  preparedBy: string;
  mceNumber?: string;
  clientReference?: string;
}

interface AggregatedLabor {
  costCode: string;
  sec: string;
  act: string;
  costHead: string;
  description: string;
  hours: number;
  laborDollars: number;
  itemCount: number;
}

interface AggregatedMaterial {
  costCode: string;
  description: string;
  materialDollars: number;
  itemCount: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get section code from floor value using floor mappings, with optional building fallback
 */
function getSectionFromFloor(
  floor: string | undefined, 
  floorMappings: FloorSectionMap, 
  drawing?: string,
  buildingMappings?: BuildingSectionMapping[],
  dbFloorMappings?: FloorSectionMapping[],
  zone?: string,
  datasetProfile?: DatasetProfile | null
): string {
  if (!floor) return '01';
  
  // If we have structured mappings, use the building-aware resolver
  if (buildingMappings && buildingMappings.length > 0 && dbFloorMappings) {
    return resolveSectionStatic(floor, drawing || '', dbFloorMappings, buildingMappings, { zone, datasetProfile });
  }
  
  // Fallback to simple floor map
  if (Object.keys(floorMappings).length === 0) return '01';
  
  const normalizedFloor = floor.toLowerCase().trim();
  
  // Try exact match first
  for (const [pattern, section] of Object.entries(floorMappings)) {
    if (pattern.toLowerCase().trim() === normalizedFloor) {
      return section;
    }
  }
  
  // Try partial match
  for (const [pattern, section] of Object.entries(floorMappings)) {
    const normalizedPattern = pattern.toLowerCase().trim();
    if (normalizedFloor.includes(normalizedPattern) || normalizedPattern.includes(normalizedFloor)) {
      return section;
    }
  }
  
  return '01'; // Default section
}

// Special value indicating category should use system mapping
const SYSTEM_MAPPING_VALUE = '__SYSTEM__';

/**
 * Get labor code from category mapping (priority over system mapping)
 * Returns null if category is set to "Use System Mapping" (__SYSTEM__)
 */
function getLaborCodeFromCategory(reportCat: string | undefined, categoryMappings: CategoryLaborMap): string | null {
  if (!reportCat || Object.keys(categoryMappings).length === 0) return null;
  
  const normalizedCat = reportCat.toLowerCase().trim();
  
  // Try exact match first
  for (const [pattern, laborCode] of Object.entries(categoryMappings)) {
    if (pattern.toLowerCase().trim() === normalizedCat) {
      // If set to __SYSTEM__, return null to defer to system mapping
      if (laborCode === SYSTEM_MAPPING_VALUE) {
        return null;
      }
      return laborCode;
    }
  }
  
  return null;
}

// ============================================
// AGGREGATION FUNCTIONS
// ============================================

/**
 * Aggregates labor data by full cost code (SEC ACT COSTHEAD)
 * @param items - Estimate items to aggregate
 * @param floorMappings - Optional floor-to-section mappings to derive section from floor
 * @param categoryMappings - Optional category-to-labor-code mappings (takes priority over item's costCode)
 */
/**
 * Rounds fractional hours to whole numbers while preserving the exact integer
 * total (Largest Remainder Method). Always round the full set together —
 * never round individual lines in isolation.
 */
export function roundHoursPreservingTotal(values: number[]): number[] {
  if (values.length === 0) return [];
  const target = Math.round(values.reduce((s, v) => s + v, 0));
  const floored = values.map(v => Math.floor(v));
  const remainders = values.map((v, i) => ({ i, r: v - floored[i] }));
  const distributed = floored.reduce((s, v) => s + v, 0);
  const leftover = target - distributed;
  remainders.sort((a, b) => b.r - a.r || a.i - b.i);
  const result = [...floored];
  for (let k = 0; k < leftover && k < remainders.length; k++) {
    result[remainders[k].i] += 1;
  }
  return result;
}

export function aggregateLaborByCostCode(
  items: ExportEstimateItem[],
  floorMappings: FloorSectionMap = {},
  options: {
    categoryMappings?: CategoryLaborMap;
    buildingMappings?: BuildingSectionMapping[];
    dbFloorMappings?: FloorSectionMapping[];
    datasetProfile?: DatasetProfile | null;
  } = {}
): AggregatedLabor[] {
  const { categoryMappings = {}, buildingMappings = [], dbFloorMappings = [], datasetProfile = null } = options;
  const aggregated = new Map<string, AggregatedLabor>();

  items.forEach(item => {
    const hours = parseFloat(String(item.hours)) || 0;
    const laborDollars = parseFloat(String(item.laborDollars)) || 0;
    
    // Skip zero-hour items entirely
    if (hours === 0 && laborDollars === 0) return;

    // Standalone floors must always re-resolve through building-aware resolver
    const isStandalone = /^(roof|ug|crawl\s*space|site|site\s+above\s+grade|attic|penthouse)$/i
      .test((item.floor || '').trim());

    let sec: string;
    let act: string;

    if (isStandalone && item.floor && buildingMappings.length > 0) {
      sec = getSectionFromFloor(item.floor, floorMappings, item.drawing,
        buildingMappings, dbFloorMappings, item.zone, datasetProfile);
      act = item.suggestedCode?.activity || '0000';
    } else {
      sec = item.laborSec || item.suggestedCode?.section;
      if (!sec && item.floor) {
        sec = getSectionFromFloor(item.floor, floorMappings, item.drawing,
          buildingMappings, dbFloorMappings, item.zone, datasetProfile);
      }
      sec = sec || '01';
      act = item.suggestedCode?.activity || '0000';
    }
    
    // LABOR CODE PRIORITY:
    // 1. Category mapping (if reportCat has assigned code)
    // 2. Item's existing costCode/laborCostHead (from system mapping)
    // 3. Suggested code
    let costHead = getLaborCodeFromCategory(item.reportCat, categoryMappings);
    if (!costHead) {
      costHead = item.laborCostHead || item.costCode || item.suggestedCode?.costHead || '';
    }
    
    let description = item.laborDescription || item.suggestedCode?.description || '';

    // CRITICAL FIX: Bucket uncoded items instead of dropping them
    if (!costHead) {
      costHead = 'UNCD';
      description = 'UNCODED ITEMS';
    }
    
    const costCode = `${sec} ${act} ${costHead}`;

    if (aggregated.has(costCode)) {
      const existing = aggregated.get(costCode)!;
      existing.hours += hours;
      existing.laborDollars += laborDollars;
      existing.itemCount++;
    } else {
      aggregated.set(costCode, {
        costCode,
        sec,
        act,
        costHead,
        description,
        hours,
        laborDollars,
        itemCount: 1
      });
    }
  });

  return Array.from(aggregated.values())
    .sort((a, b) => a.costCode.localeCompare(b.costCode));
}

/**
 * Aggregates material data by material cost code
 */
export function aggregateMaterialByCostCode(items: ExportEstimateItem[]): AggregatedMaterial[] {
  const aggregated = new Map<string, AggregatedMaterial>();

  items.forEach(item => {
    const costCode = item.materialCode || item.materialCostCode || '';
    
    if (!costCode) return; // Skip items without material code
    
    const description = item.materialCodeDescription || '';
    const materialDollars = parseFloat(String(item.materialDollars)) || 0;

    if (aggregated.has(costCode)) {
      const existing = aggregated.get(costCode)!;
      existing.materialDollars += materialDollars;
      existing.itemCount++;
    } else {
      aggregated.set(costCode, {
        costCode,
        description,
        materialDollars,
        itemCount: 1
      });
    }
  });

  return Array.from(aggregated.values())
    .sort((a, b) => a.costCode.localeCompare(b.costCode));
}

/**
 * Validates that exported hours match raw item hours.
 * Logs a warning if there's a mismatch (prevents silent hour loss).
 */
function validateHoursReconciliation(
  items: ExportEstimateItem[],
  laborSummary: AggregatedLabor[]
): void {
  const rawTotal = items.reduce((sum, item) => {
    return sum + (parseFloat(String(item.hours)) || 0);
  }, 0);
  
  const exportTotal = laborSummary.reduce((sum, entry) => sum + entry.hours, 0);
  const delta = Math.abs(rawTotal - exportTotal);
  
  if (delta >= 0.1) {
    if (import.meta.env.DEV) console.warn(
      `⚠️ HOURS RECONCILIATION MISMATCH: Raw ${rawTotal.toFixed(2)} hrs vs export ${exportTotal.toFixed(2)} hrs. Delta: ${delta.toFixed(2)} hrs.`
    );
  } else {
    if (import.meta.env.DEV) console.log(`✓ Hours reconciliation passed: ${rawTotal.toFixed(2)} hrs`);
  }
}

// ============================================
// BUDGET PACKET EXPORT (Exact Template Match with Formulas)
// ============================================

/**
 * Exports Budget Packet matching Murray Company Budget_Packet.xls format exactly
 * Now accepts optional budgetAdjustments to use adjusted labor/material data
 * @param floorMappings - Optional floor-to-section mappings for deriving section from floor
 * @param categoryMappings - Optional category-to-labor-code mappings (takes priority over system mappings)
 */
/**
 * Builds the Cost Code Look Up sheet — exact match to Murray Budget_Packet.xls template.
 * 862 static codes, always current with the official Murray standard.
 */
function buildCostCodeLookupSheet(): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  ws['A1'] = { t: 's', v: 'Cost Type' };
  ws['B1'] = { t: 's', v: 'Description' };
  COST_CODE_LOOKUP.forEach(([code, desc], i) => {
    const row = i + 2;
    ws[`A${row}`] = { t: 's', v: code };
    ws[`B${row}`] = { t: 's', v: desc };
  });
  ws['!ref'] = `A1:B${COST_CODE_LOOKUP.length + 1}`;
  ws['!cols'] = [{ wch: 10 }, { wch: 50 }];
  return ws;
}

/**
 * Builds the TEMPLATE CO sheet — exact structure matching Murray Budget_Packet.xls TEMPLATE tab.
 * Blank CO worksheet with formulas, ready for PM use.
 */
function buildTemplateSheet(projectInfo: ProjectInfo): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  // Header
  ws['E1'] = { t: 's', v: '                         CHANGE ORDER' };
  ws['F1'] = { t: 's', v: 'MURRAY COMPANY - CHANGE ORDER WORKSHEET' };
  ws['K1'] = { t: 'n', v: new Date().getTime() / 86400000 + 25569, z: 'mm/dd/yyyy' };

  ws['B3'] = { t: 's', v: 'Job #:' };
  ws['C3'] = { t: 's', v: projectInfo.jobNumber };
  ws['H3'] = { t: 's', v: 'X' };
  ws['I3'] = { t: 's', v: 'MCE #:' };
  ws['J3'] = { t: 's', v: 'TEMPLATE' };

  ws['B4'] = { t: 's', v: 'Name:' };
  ws['C4'] = { t: 's', v: projectInfo.jobName };

  ws['B5'] = { t: 's', v: 'Date:' };
  ws['C5'] = { t: 's', v: projectInfo.date.toLocaleDateString() };
  ws['I5'] = { t: 's', v: 'C/O #:' };

  ws['B6'] = { t: 's', v: 'By:' };
  ws['C6'] = { t: 's', v: projectInfo.preparedBy };

  ws['B7'] = { t: 's', v: 'Client Change Reference:' };
  ws['I7'] = { t: 's', v: 'B/R #:' };

  // Labor section
  ws['B10'] = { t: 's', v: 'LABOR' };
  ws['B11'] = { t: 's', v: 'Cost Code' };
  ws['E11'] = { t: 's', v: 'Description' };
  ws['I11'] = { t: 's', v: 'Hours' };
  ws['J11'] = { t: 's', v: 'Rate' };
  ws['K11'] = { t: 's', v: 'Total Cost' };

  // 13 blank labor rows with H*I formula for Total Cost
  const LABOR_DATA_START = 12;
  const LABOR_DATA_END = 24;
  for (let r = LABOR_DATA_START; r <= LABOR_DATA_END; r++) {
    ws[`K${r}`] = { t: 'n', f: `I${r}*J${r}`, v: 0, z: '#,##0.00' };
  }

  // Non-labor section
  ws['B25'] = { t: 's', v: 'NON LABOR' };
  ws['B26'] = { t: 's', v: 'Cost Code' };
  ws['E26'] = { t: 's', v: 'Description' };
  ws['K26'] = { t: 's', v: 'Total Cost' };

  // 20 blank non-labor rows
  const NONLABOR_DATA_START = 27;
  const NONLABOR_DATA_END = 46;
  for (let r = NONLABOR_DATA_START; r <= NONLABOR_DATA_END; r++) {
    ws[`K${r}`] = { t: 'n', v: 0, z: '#,##0.00' };
  }

  // Summary rows
  const laborSum = `SUM(K${LABOR_DATA_START}:K${LABOR_DATA_END})`;
  const nonLaborSum = `SUM(K${NONLABOR_DATA_START}:K${NONLABOR_DATA_END})`;
  const hoursSum = `SUM(I${LABOR_DATA_START}:I${LABOR_DATA_END})`;

  ws['J47'] = { t: 's', v: 'TOTAL COST' };
  ws['K47'] = { t: 'n', f: `${laborSum}+${nonLaborSum}`, v: 0, z: '#,##0.00' };

  ws['E48'] = { t: 's', v: 'Labor Hours Total' };
  ws['G48'] = { t: 'n', f: hoursSum, v: 0, z: '#,##0' };
  ws['J48'] = { t: 's', v: 'PLUS' };

  ws['E49'] = { t: 's', v: 'Labor $$ Total' };
  ws['G49'] = { t: 'n', f: laborSum, v: 0, z: '#,##0.00' };
  ws['H49'] = { t: 'n', v: 0, z: '#,##0.00' };
  ws['J49'] = { t: 's', v: 'MARKUP' };
  ws['K49'] = { t: 'n', v: 0, z: '#,##0.00' };

  ws['E50'] = { t: 's', v: 'Material Total' };
  ws['G50'] = { t: 'n', f: nonLaborSum, v: 0, z: '#,##0.00' };
  ws['H50'] = { t: 'n', v: 0, z: '#,##0.00' };
  ws['J50'] = { t: 's', v: 'MARGIN %' };
  ws['K50'] = { t: 'n', v: 0, z: '#,##0' };

  ws['J51'] = { t: 's', v: 'TOTAL' };
  ws['K51'] = { t: 'n', f: `K47+K49`, v: 0, z: '#,##0.00' };

  ws['!ref'] = 'A1:K51';
  ws['!cols'] = [
    { wch: 3 },   // A
    { wch: 16 },  // B
    { wch: 18 },  // C
    { wch: 12 },  // D
    { wch: 25 },  // E
    { wch: 8 },   // F
    { wch: 12 },  // G
    { wch: 12 },  // H
    { wch: 10 },  // I
    { wch: 14 },  // J
    { wch: 14 },  // K
  ];

  return ws;
}

export function exportBudgetPacket(
  items: ExportEstimateItem[],
  projectInfo: ProjectInfo,
  laborRate: number = 0,
  budgetAdjustments?: BudgetAdjustments | null,
  floorMappings: FloorSectionMap = {},
  categoryMappings: CategoryLaborMap = {},
  buildingMappings: BuildingSectionMapping[] = [],
  dbFloorMappings: FloorSectionMapping[] = []
): { laborCodes: number; materialCodes: number; totalLaborHours: number; totalLaborDollars: number; totalMaterialDollars: number; grandTotal: number } {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  // Determine data source: use Budget Adjustments if available, otherwise raw aggregation
  let laborData: Array<{ code: string; description: string; hours: number; dollars: number; rate?: number }>;
  let materialData: Array<{ code: string; description: string; amount: number }>;
  let totalLaborHours = 0;
  let totalLaborDollars = 0;
  let totalMaterialDollars = 0;

  if (budgetAdjustments && Object.keys(budgetAdjustments.adjustedLaborSummary || {}).length > 0) {
    // USE BUDGET BUILDER ADJUSTMENTS (includes FAB codes, strips already applied)
    laborData = Object.values(budgetAdjustments.adjustedLaborSummary)
      .filter(item => Math.abs(item.hours ?? 0) >= 0.05)
      .map(item => ({
        code: item.code,
        description: item.description,
        hours: item.hours,
        dollars: item.dollars,
        rate: item.rate
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    // CRITICAL: Compute totals from the SAME data that gets written to rows
    // This ensures H55 totals always match the sum of individual rows
    totalLaborHours = laborData.reduce((sum, i) => sum + i.hours, 0);
    totalLaborDollars = laborData.reduce((sum, i) => sum + i.dollars, 0);

    // Material: Include tax directly in each code's amount (tax-inclusive amounts)
    materialData = (budgetAdjustments.materialTaxSummary || [])
      .map(item => ({
        code: item.code,
        description: item.description,
        amount: item.amount + item.taxAmount // Include tax in the material amount
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    // Total material includes tax
    totalMaterialDollars = budgetAdjustments.totalMaterialWithTax || 0;
  } else {
    // FALLBACK: Use raw item aggregation (no adjustments)
    const rawLaborSummary = aggregateLaborByCostCode(items, floorMappings, { categoryMappings, buildingMappings, dbFloorMappings });
    validateHoursReconciliation(items, rawLaborSummary);
    laborData = rawLaborSummary.map(item => ({
      code: item.costCode,
      description: item.description,
      hours: item.hours,
      dollars: item.hours * laborRate
    }));

    totalLaborHours = laborData.reduce((sum, i) => sum + i.hours, 0);
    totalLaborDollars = laborData.reduce((sum, i) => sum + i.dollars, 0);

    const rawMaterialSummary = aggregateMaterialByCostCode(items);
    materialData = rawMaterialSummary.map(item => ({
      code: item.costCode,
      description: item.description,
      amount: item.materialDollars
    }));

    totalMaterialDollars = materialData.reduce((sum, i) => sum + i.amount, 0);
  }

  // ===== FIRST HEADER SECTION (Rows 1-16) =====
  ws['D2'] = { t: 's', v: '  NEW JOB / CHANGE ORDER' };
  ws['E3'] = { t: 's', v: '   WORKSHEET' };
  
  ws['B6'] = { t: 's', v: 'JOB #:' };
  ws['C6'] = { t: 's', v: projectInfo.jobNumber };
  ws['H6'] = { t: 's', v: '  Pending Change Order (MPCO)' };
  
  ws['B7'] = { t: 's', v: 'JOB NAME:' };
  ws['C7'] = { t: 's', v: projectInfo.jobName };
  ws['H7'] = { t: 's', v: ' MCE # (s)' };
  ws['I7'] = { t: 's', v: 'Initial Budget' };
  
  ws['B8'] = { t: 's', v: 'DATE:' };
  ws['C8'] = { t: 's', v: projectInfo.date.toLocaleDateString() };
  
  ws['B9'] = { t: 's', v: 'BY:' };
  ws['C9'] = { t: 's', v: projectInfo.preparedBy };
  ws['H9'] = { t: 's', v: '  Change Order  (CO)' };
  
  ws['H10'] = { t: 's', v: ' (if PCO transfer to CO, see page 2)' };
  ws['H11'] = { t: 's', v: '     CO # ' };
  
  ws['B13'] = { t: 's', v: 'Client Change Reference:' };
  ws['D13'] = { t: 's', v: projectInfo.clientReference || '' };
  ws['G13'] = { t: 's', v: 'X' };
  ws['H13'] = { t: 's', v: 'Original Budget' };
  
  ws['H16'] = { t: 's', v: 'APPROVAL:' };

  // ===== LABOR BREAKDOWN SECTION (Rows 17-55) =====
  ws['B17'] = { t: 's', v: 'LABOR BREAKDOWN' };
  
  // Row 18: Column headers
  ws['B18'] = { t: 's', v: 'Cost Code' };
  ws['D18'] = { t: 's', v: 'DESCRIPTION' };
  ws['H18'] = { t: 's', v: ' # of HOURS' };
  ws['I18'] = { t: 's', v: 'RATE' };
  ws['J18'] = { t: 's', v: 'TOTAL COST' };

  // Labor data: dynamic row count based on actual data
  const LABOR_START_ROW = 19;
  // Calculate needed rows: count items + section headers
  const sectionCount = new Set(laborData.map(item => parseLaborCode(item.code).section)).size;
  const neededLaborRows = laborData.length + sectionCount;
  const LABOR_END_ROW = LABOR_START_ROW + neededLaborRows; // Dynamic end
  
  // Parse and normalize labor codes, group by section
  const parsedLabor = laborData.map(item => {
    const parsed = parseLaborCode(item.code);
    // Use parsed code's description lookup, falling back to item's description
    const description = getLaborCostHeadDescription(parsed.costHead) || item.description || parsed.costHead;
    return {
      ...item,
      section: parsed.section,
      activity: parsed.activity,
      costHead: parsed.costHead,
      normalizedCode: parsed.fullCode,
      normalizedDescription: description
    };
  });
  
  // Group by section
  const sectionGroups = new Map<string, typeof parsedLabor>();
  parsedLabor.forEach(item => {
    const section = item.section;
    if (!sectionGroups.has(section)) {
      sectionGroups.set(section, []);
    }
    sectionGroups.get(section)!.push(item);
  });
  
  // Sort sections
  const sortedSections = Array.from(sectionGroups.keys()).sort();
  
  let laborRowIndex = 0;
  const laborDataRows: number[] = []; // Track rows with actual hour data for SUM formulas
  sortedSections.forEach(section => {
    const sectionItems = sectionGroups.get(section)!;
    
    // Add section header
    const headerRow = LABOR_START_ROW + laborRowIndex;
    const sectionDesc = getSectionDescription(section);
    ws[`B${headerRow}`] = { t: 's', v: `SECTION ${section} - ${sectionDesc}` };
    laborRowIndex++;
    
    // Add items in this section
    sectionItems.forEach(item => {
      const row = LABOR_START_ROW + laborRowIndex;
      
      ws[`B${row}`] = { t: 's', v: item.normalizedCode };
      ws[`D${row}`] = { t: 's', v: item.normalizedDescription };
      ws[`H${row}`] = { t: 'n', v: Math.round(item.hours), z: '#,##0' };
      
      const displayRate = item.rate ?? laborRate;
      if (displayRate > 0) {
        ws[`I${row}`] = { t: 'n', v: displayRate, z: '#,##0.00' };
      }
      
      ws[`J${row}`] = { t: 'n', v: Math.round(item.dollars * 100) / 100, z: '#,##0' };
      laborDataRows.push(row); // Track this row for SUM formula
      laborRowIndex++;
    });
  });

  // TOTALS row: dynamic position right after data
  const TOTALS_ROW = LABOR_START_ROW + laborRowIndex + 1;
  
  // Use SUM formulas so totals ALWAYS match the visible rows
  const hoursSumParts = laborDataRows.map(r => `H${r}`).join('+');
  const dollarsSumParts = laborDataRows.map(r => `J${r}`).join('+');
  
  ws[`E${TOTALS_ROW}`] = { t: 's', v: 'TOTALS' };
  ws[`H${TOTALS_ROW}`] = { 
    t: 'n', 
    f: hoursSumParts || '0',
    v: Math.round(laborData.reduce((s, i) => s + i.hours, 0)),
    z: '#,##0' 
  };
  ws[`J${TOTALS_ROW}`] = { 
    t: 'n', 
    f: dollarsSumParts || '0',
    v: Math.round(laborData.reduce((s, i) => s + i.dollars, 0) * 100) / 100,
    z: '#,##0' 
  };

  // ===== SECOND HEADER BLOCK - Before Material Section =====
  const HEADER2_START = TOTALS_ROW + 3;
  ws[`D${HEADER2_START}`] = { t: 's', v: '   CHANGE ORDER' };
  ws[`E${HEADER2_START + 1}`] = { t: 's', v: '   WORKSHEET' };
  
  ws[`B${HEADER2_START + 4}`] = { t: 's', v: 'JOB #:' };
  ws[`C${HEADER2_START + 4}`] = { t: 's', v: projectInfo.jobNumber };
  ws[`G${HEADER2_START + 4}`] = { t: 's', v: '0' };
  ws[`H${HEADER2_START + 4}`] = { t: 's', v: '  Pending Change Order (MPCO)' };
  
  ws[`B${HEADER2_START + 5}`] = { t: 's', v: 'JOB NAME:' };
  ws[`C${HEADER2_START + 5}`] = { t: 's', v: projectInfo.jobName };
  ws[`H${HEADER2_START + 5}`] = { t: 's', v: ' MCE # (s)' };
  ws[`I${HEADER2_START + 5}`] = { t: 's', v: 'Initial Budget' };
  
  ws[`B${HEADER2_START + 6}`] = { t: 's', v: 'DATE:' };
  ws[`C${HEADER2_START + 6}`] = { t: 's', v: projectInfo.date.toLocaleDateString() };
  
  ws[`B${HEADER2_START + 7}`] = { t: 's', v: 'BY:' };
  ws[`C${HEADER2_START + 7}`] = { t: 's', v: projectInfo.preparedBy };
  ws[`H${HEADER2_START + 7}`] = { t: 's', v: '  Change Order  (CO)' };
  
  ws[`H${HEADER2_START + 8}`] = { t: 's', v: ' (if PCO transfer to CO, see page 2)' };
  ws[`H${HEADER2_START + 9}`] = { t: 's', v: '     CO # ' };
  ws[`I${HEADER2_START + 9}`] = { t: 's', v: '0' };
  
  ws[`B${HEADER2_START + 11}`] = { t: 's', v: 'Client Change Reference:' };
  ws[`G${HEADER2_START + 11}`] = { t: 's', v: 'X' };
  ws[`H${HEADER2_START + 11}`] = { t: 's', v: 'Original Budget' };
  ws[`I${HEADER2_START + 12}`] = { t: 's', v: '0' };

  // ===== MATERIAL BREAKDOWN SECTION =====
  const MATERIAL_HEADER_ROW = HEADER2_START + 15;
  const MATERIAL_COLS_ROW = MATERIAL_HEADER_ROW + 1;
  const MATERIAL_START_ROW = MATERIAL_COLS_ROW + 1;
  
  ws[`B${MATERIAL_HEADER_ROW}`] = { t: 's', v: 'MATERIAL BREAKDOWN' };
  
  ws[`B${MATERIAL_COLS_ROW}`] = { t: 's', v: 'Cost Code' };
  ws[`D${MATERIAL_COLS_ROW}`] = { t: 's', v: 'DESCRIPTION' };
  ws[`H${MATERIAL_COLS_ROW}`] = { t: 's', v: 'AMOUNT' };

  // Material data rows
  let materialRowIndex = 0;
  materialData.forEach((item) => {
    const row = MATERIAL_START_ROW + materialRowIndex;
    
    // Format material code as "01 0000 {code}" to match template format
    const formattedCode = item.code.includes(' ') ? item.code : `01 0000 ${item.code}`;
    
    ws[`B${row}`] = { t: 's', v: formattedCode };
    ws[`D${row}`] = { t: 's', v: item.description || getMaterialCodeDescription(item.code) };
    ws[`H${row}`] = { t: 'n', v: Math.round(item.amount * 100) / 100, z: '#,##0.00' };
    materialRowIndex++;
  });

  // Add Foreman Bonus Contingency (FCNT) to material section if enabled
  if (budgetAdjustments && budgetAdjustments.foremanBonusEnabled && budgetAdjustments.foremanBonusDollars > 0) {
    const fcntRow = MATERIAL_START_ROW + materialRowIndex;
    ws[`B${fcntRow}`] = { t: 's', v: 'GC 0000 FCNT' };
    ws[`D${fcntRow}`] = { t: 's', v: `FIELD BONUS CONTINGENCY ${budgetAdjustments.foremanBonusPercent}% - STRIP OF FIELD LABOR` };
    ws[`H${fcntRow}`] = { t: 'n', v: Math.round(budgetAdjustments.foremanBonusDollars * 100) / 100, z: '#,##0.00' };
    totalMaterialDollars += budgetAdjustments.foremanBonusDollars;
    materialRowIndex++;
  }

  // Add LRCN (Labor Rate Contingency) line if enabled and has positive amount
  if (budgetAdjustments && budgetAdjustments.laborRateContingencyEnabled && budgetAdjustments.lrcnAmount > 0) {
    const lrcnRow = MATERIAL_START_ROW + materialRowIndex;
    ws[`B${lrcnRow}`] = { t: 's', v: '01 0000 LRCN' };
    ws[`D${lrcnRow}`] = { t: 's', v: 'LABOR RATE CONTINGENCY' };
    ws[`H${lrcnRow}`] = { t: 'n', v: Math.round(budgetAdjustments.lrcnAmount * 100) / 100, z: '#,##0.00' };
    totalMaterialDollars += budgetAdjustments.lrcnAmount;
    materialRowIndex++;
  }

  // Add Fab LRCN (Fab Labor Rate Contingency) line if enabled and has positive amount
  if (budgetAdjustments?.fabLrcnEnabled && budgetAdjustments?.fabLrcnAmount > 0) {
    const fabLrcnRow = MATERIAL_START_ROW + materialRowIndex;
    ws[`B${fabLrcnRow}`] = { t: 's', v: 'MA 0FAB LRCN' };
    ws[`D${fabLrcnRow}`] = { t: 's', v: 'FAB LABOR RATE CONTINGENCY' };
    ws[`H${fabLrcnRow}`] = { t: 'n', v: Math.round(budgetAdjustments.fabLrcnAmount * 100) / 100, z: '#,##0.00' };
    totalMaterialDollars += budgetAdjustments.fabLrcnAmount;
    materialRowIndex++;
  }

  // Add GC 0FAB CONT — unbudgeted shop hour volume contingency.
  // Math lives in computeGcFabCont() at the bottom of this file (single source of truth).
  {
    const gcFabContAmount = computeGcFabCont(budgetAdjustments);
    if (gcFabContAmount > 0) {
      const gcFabContRow = MATERIAL_START_ROW + materialRowIndex;
      ws[`B${gcFabContRow}`] = { t: 's', v: 'GC 0FAB CONT' };
      ws[`D${gcFabContRow}`] = { t: 's', v: 'UNBUDGETED SHOP HOUR VOLUME CONTINGENCY' };
      ws[`H${gcFabContRow}`] = { t: 'n', v: gcFabContAmount, z: '#,##0.00' };
      totalMaterialDollars += gcFabContAmount;
      materialRowIndex++;
    }
  }

  // Add GC 0FLD CONT — unbudgeted field hour volume contingency.
  // Math lives in computeGcFldCont() at the bottom of this file (single source of truth).
  // Foreman hours are added back to budget side inside the helper to prevent FCNT double-counting.
  {
    const gcFldContAmount = computeGcFldCont(budgetAdjustments);
    if (gcFldContAmount > 0) {
      const gcFldContRow = MATERIAL_START_ROW + materialRowIndex;
      ws[`B${gcFldContRow}`] = { t: 's', v: 'GC 0FLD CONT' };
      ws[`D${gcFldContRow}`] = { t: 's', v: 'UNBUDGETED FIELD HOUR VOLUME CONTINGENCY' };
      ws[`H${gcFldContRow}`] = { t: 'n', v: gcFldContAmount, z: '#,##0.00' };
      totalMaterialDollars += gcFldContAmount;
      materialRowIndex++;
    }
  }

  const grandTotal = totalLaborDollars + totalMaterialDollars;
  const SUMMARY_BOX_ROW = MATERIAL_START_ROW + 2;
  ws[`J${SUMMARY_BOX_ROW}`] = { t: 's', v: 'TOTAL COST' };
  ws[`K${SUMMARY_BOX_ROW}`] = { 
    t: 'n', 
    v: Math.round(grandTotal * 100) / 100,
    z: '#,##0.00'
  };
  
  ws[`J${SUMMARY_BOX_ROW + 1}`] = { t: 's', v: 'PLUS' };
  
  ws[`J${SUMMARY_BOX_ROW + 2}`] = { t: 's', v: 'MARKUP' };
  ws[`K${SUMMARY_BOX_ROW + 2}`] = { t: 'n', v: 0, z: '#,##0' };
  
  ws[`J${SUMMARY_BOX_ROW + 3}`] = { t: 's', v: 'TOTAL' };
  ws[`K${SUMMARY_BOX_ROW + 3}`] = { 
    t: 'n', 
    v: Math.round(grandTotal * 100) / 100,
    z: '#,##0.00'
  };
  
  ws[`J${SUMMARY_BOX_ROW + 4}`] = { t: 's', v: '(PCO, TRNSFR, CO, or RVSN)' };

  // ===== BOTTOM SUMMARY ROWS =====
  const BOTTOM_START = MATERIAL_START_ROW + materialRowIndex + 2;
  ws[`G${BOTTOM_START}`] = { t: 's', v: 'MATERIAL TOTAL -->' };
  ws[`H${BOTTOM_START}`] = { 
    t: 'n', 
    v: Math.round(totalMaterialDollars * 100) / 100,
    z: '#,##0.00'
  };
  
  ws[`G${BOTTOM_START + 2}`] = { t: 's', v: 'LABOR TOTAL -->' };
  ws[`H${BOTTOM_START + 2}`] = { t: 'n', v: Math.round(totalLaborDollars * 100) / 100, z: '#,##0.00' };
  
  ws[`G${BOTTOM_START + 4}`] = { t: 's', v: 'TOTAL -->' };
  ws[`H${BOTTOM_START + 4}`] = { t: 'n', v: Math.round(grandTotal * 100) / 100, z: '#,##0.00' };

  // ===== WORKSHEET CONFIGURATION =====
  ws['!cols'] = [
    { wch: 3 },   // A
    { wch: 16 },  // B - Cost Code
    { wch: 18 },  // C - Job info values
    { wch: 25 },  // D - Description
    { wch: 12 },  // E - TOTALS label
    { wch: 8 },   // F
    { wch: 20 },  // G - Bottom totals labels
    { wch: 14 },  // H - Hours / Amount
    { wch: 10 },  // I - Rate
    { wch: 14 },  // J - Total Cost / Summary labels
    { wch: 14 },  // K - Summary values
  ];

  const lastRow = BOTTOM_START + 5;
  ws['!ref'] = `A1:K${lastRow}`;

  XLSX.utils.book_append_sheet(wb, ws, 'Initial Budget');

  // Generate filename and download
  const dateStr = projectInfo.date.toISOString().split('T')[0];
  const safeName = projectInfo.jobNumber.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Budget_Packet_${safeName}_${dateStr}.xlsx`;

  // Append Cost Code Look Up sheet (862 Murray standard codes)
  XLSX.utils.book_append_sheet(wb, buildCostCodeLookupSheet(), 'Cost Code Look Up');

  // Append blank TEMPLATE CO sheet
  XLSX.utils.book_append_sheet(wb, buildTemplateSheet(projectInfo), 'TEMPLATE');

  XLSX.writeFile(wb, filename);

  return {
    laborCodes: laborData.length,
    materialCodes: materialData.length,
    totalLaborHours,
    totalLaborDollars,
    totalMaterialDollars,
    grandTotal
  };
}

/**
 * Helper: Get material code description
 */
function getMaterialCodeDescription(code: string): string {
  const descriptions: Record<string, string> = {
    '9510': 'PIPE',
    '9511': 'CAST IRON PIPE & FITTINGS',
    '9512': 'COPPER PIPE & FITTINGS',
    '9513': 'PLASTIC PIPE & FITTINGS',
    '9514': 'STAINLESS STEEL PIPE & FITTINGS',
    '9515': 'CARBON STEEL PIPE & FITTINGS',
    '9520': 'SPECIALTIES',
    '9521': 'HANGERS & SUPPORTS',
    '9522': 'INSULATION',
    '9523': 'IDENTIFICATION',
    '9524': 'VALVES',
    '9525': 'FIXTURES',
    '9526': 'EQUIPMENT',
    '9530': 'FITTINGS',
    '9540': 'FLANGES',
    '9550': 'MISCELLANEOUS',
    '9560': 'TESTING',
    '9570': 'CONSUMABLES',
    'MCKM': 'MISCELLANEOUS MATERIAL',
  };
  // Try exact match first, then try just the numeric part
  return descriptions[code] || descriptions[code.replace(/\D/g, '')] || '';
}

/**
 * Helper: Get section description for headers
 */
function getSectionDescription(section: string): string {
  const descriptions: Record<string, string> = {
    '01': 'GENERAL CONDITIONS',
    'BG': 'BELOW GRADE',
    'CL': 'CLUB LEVEL',
    'CN': 'CONCOURSE',
    'FL': 'FIELD LEVEL',
    'GC': 'GENERAL CONDITIONS',
    'ME': 'MECHANICAL',
    'PH': 'PENTHOUSE',
    'RF': 'ROOF',
    'SU': 'SUITE LEVEL',
    'TE': 'TERRACE',
    'UP': 'UPPER LEVEL',
    'LO': 'LOWER LEVEL',
    '02': 'SECOND FLOOR',
    '03': 'THIRD FLOOR',
    '04': 'FOURTH FLOOR',
    '05': 'FIFTH FLOOR',
  };
  return descriptions[section] || section;
}

/**
 * Helper: Get labor cost head description
 */
function getLaborCostHeadDescription(costHead: string): string {
  const descriptions: Record<string, string> = {
    'FCNT': 'FOREMAN CONTINGENCY',
    'BGGW': 'BELOW GRADE GREASE WASTE',
    'BGSD': 'BELOW GRADE STORM DRAIN',
    'BGTP': 'BELOW GRADE TRAP PRIMERS',
    'BGWT': 'BELOW GRADE DOMESTIC WATER',
    'BGWV': 'BELOW GRADE WASTE & VENT',
    'COND': 'CONDENSATE',
    'DEMO': 'DEMOLITION',
    'DRNS': 'DRAINS',
    'DWTR': 'DOMESTIC WATER',
    'FNSH': 'FIXTURES',
    'FUEL': 'FUEL OIL',
    'GRWV': 'GREASE WASTE AND VENT',
    'HNGS': 'HANGERS AND SUPPORTS',
    'IWTR': 'INDUSTRIAL WATER',
    'NGAS': 'NATURAL GAS',
    'PIDV': 'PIPE ID AND VALVE TAGS',
    'RCLM': 'RECLAIMED WATER',
    'SEQP': 'EQUIPMENT SETTING',
    'SLVS': 'SLEEVES',
    'SNWV': 'SANITARY WASTE AND VENT',
    'SPCL': 'SPECIALTIES',
    'STRM': 'STORM DRAIN',
    'SZMC': 'SEISMIC',
    'TRAP': 'TRAP PRIMERS',
    'GRAY': 'GRAY WATER',
    // Fab material codes (match COST_CODE_LOOKUP descriptions)
    'CSTI': 'CAST IRON FAB',
    'CSTF': 'CARBON STEEL TEFLON LINED',
    'COPR': 'FAB - COPPER',
    'CRBN': 'CARBON STEEL PIPING',
    'SSTL': 'STAINLESS STEEL PIPING',
    'SS10': 'STAINLESS STEEL SCH 10',
    'PLST': 'PLASTIC PIPING',
    'BRAZ': 'BRAZED COPPER',
    'HFBS': 'HANGERS FAB SHEETS',
  };
  return descriptions[costHead] || costHead;
}

/**
 * Helper: Parse and normalize cost code to remove duplicates
 * Input like "BG 0000 BG 0000 BGGW" returns { section: "BG", activity: "0000", costHead: "BGGW", fullCode: "BG 0000 BGGW" }
 */
function parseLaborCode(code: string): { section: string; activity: string; costHead: string; fullCode: string } {
  const parts = code.trim().split(/\s+/);
  
  // Detect doubled codes: "BG 0000 BG 0000 BGGW" (5 parts) or "BG 0000 BG 0000 BGGW EXTRA" (6+ parts)
  // Pattern: parts[0] === parts[2] && parts[1] === parts[3] indicates duplication
  if (parts.length >= 5 && parts[0] === parts[2] && parts[1] === parts[3]) {
    // Doubled - take section from [0], activity from [1], cost head from [4] onwards
    return {
      section: parts[0],
      activity: parts[1],
      costHead: parts.slice(4).join(' '),
      fullCode: `${parts[0]} ${parts[1]} ${parts.slice(4).join(' ')}`
    };
  } else if (parts.length >= 3) {
    // Normal format "BG 0000 BGGW"
    return {
      section: parts[0],
      activity: parts[1],
      costHead: parts.slice(2).join(' '),
      fullCode: code.trim()
    };
  } else if (parts.length === 2) {
    // Missing activity
    return {
      section: parts[0],
      activity: '0000',
      costHead: parts[1],
      fullCode: `${parts[0]} 0000 ${parts[1]}`
    };
  } else {
    // Just cost head
    return {
      section: '01',
      activity: '0000',
      costHead: parts[0] || '',
      fullCode: `01 0000 ${parts[0] || ''}`
    };
  }
}

// ============================================
// AUDIT REPORT EXPORT (Detailed Line Items)
// ============================================

interface SavedMerge {
  sec_code: string;
  cost_head: string;
  reassign_to_head?: string | null;
  redistribute_adjustments?: Record<string, number> | null;
  merged_act: string;
}

/**
 * Determines the adjustment label for an item based on saved merges
 */
function getAdjustmentLabel(sec: string, costHead: string, savedMerges: SavedMerge[]): string {
  for (const merge of savedMerges) {
    if (merge.sec_code !== sec) continue;
    if (merge.cost_head !== costHead) continue;
    if (merge.reassign_to_head) {
      if (merge.reassign_to_head === '__keep__') return 'Kept as-is';
      return `Reassigned → ${merge.sec_code} ${merge.merged_act} ${merge.reassign_to_head}`;
    }
    if (merge.redistribute_adjustments && Object.keys(merge.redistribute_adjustments).length > 0) {
      return 'Redistributed';
    }
    return `Merged → ${merge.sec_code} ${merge.merged_act} ${merge.cost_head}`;
  }
  return '';
}

/**
 * Prepares labor report data for audit export
 */
function prepareLaborReportData(
  items: ExportEstimateItem[],
  floorMappings: FloorSectionMap = {},
  buildingMappings: BuildingSectionMapping[] = [],
  dbFloorMappings: FloorSectionMapping[] = [],
  datasetProfile: any = null,
  savedMerges: SavedMerge[] = []
): any[] {
  return items
    .filter(item => item.laborCostHead || item.costCode || item.suggestedCode?.costHead)
    .map(item => {
      const isStandalone = /^(roof|ug|crawl\s*space|site|site\s+above\s+grade|attic|penthouse)$/i
        .test((item.floor || '').trim());

      let sec: string;
      if (isStandalone && item.floor && buildingMappings.length > 0) {
        sec = getSectionFromFloor(item.floor, floorMappings, item.drawing,
          buildingMappings, dbFloorMappings, item.zone, datasetProfile);
      } else {
        sec = item.laborSec || item.suggestedCode?.section;
        if (!sec && item.floor) {
          sec = getSectionFromFloor(item.floor, floorMappings, item.drawing,
            buildingMappings, dbFloorMappings, item.zone, datasetProfile);
        }
        sec = sec || '01';
      }

      const costHead = item.laborCostHead || item.costCode || item.suggestedCode?.costHead || '';
      const adjustment = savedMerges.length > 0 ? getAdjustmentLabel(sec, costHead, savedMerges) : '';

      return {
        'SEC': sec,
        'ACT': item.suggestedCode?.activity || '0000',
        'COST HEAD': costHead,
        'DESCRIPTION': item.laborDescription || item.suggestedCode?.description || '',
        'Drawing': item.drawing || '',
        'System': item.system || '',
        'Floor': item.floor || '',
        'Zone': item.zone || '',
        'Material Spec': item.materialSpec || '',
        'Item Type': item.itemType || '',
        'Material Description': item.materialDesc || item.materialDescription || '',
        'Item Name': item.itemName || '',
        'Size': item.size || '',
        'Quantity': item.quantity || 0,
        'Hours': item.hours || 0,
        'Labor Dollars': item.laborDollars || 0,
        'Adjustment': adjustment,
      };
    });
}

/**
 * Prepares material report data for audit export
 */
function prepareMaterialReportData(items: ExportEstimateItem[]): any[] {
  return items
    .filter(item => item.materialCode || item.materialCostCode)
    .map(item => ({
      'Material Code': item.materialCode || item.materialCostCode || '',
      'Code Description': item.materialCodeDescription || '',
      'Drawing': item.drawing || '',
      'System': item.system || '',
      'Floor': item.floor || '',
      'Zone': item.zone || '',
      'Material Spec': item.materialSpec || '',
      'Item Type': item.itemType || '',
      'Material Description': item.materialDesc || item.materialDescription || '',
      'Item Name': item.itemName || '',
      'Size': item.size || '',
      'Quantity': item.quantity || 0,
      'List Price': item.listPrice || 0,
      'Material Dollars': item.materialDollars || 0
    }));
}

/**
 * Exports detailed Audit Report with Labor and Material tabs
 * @param floorMappings - Optional floor-to-section mappings for deriving section from floor
 */
export function exportAuditReport(
  items: ExportEstimateItem[],
  projectInfo: ProjectInfo,
  floorMappings: FloorSectionMap = {},
  buildingMappings: BuildingSectionMapping[] = [],
  dbFloorMappings: FloorSectionMapping[] = [],
  budgetAdjustments?: BudgetAdjustments | null
): { laborItems: number; materialItems: number; totalItems: number } {
  const wb = XLSX.utils.book_new();

  const savedMerges: SavedMerge[] = budgetAdjustments?.savedMerges ?? [];

  // Labor Report tab (detailed line items)
  const laborData = prepareLaborReportData(items, floorMappings, buildingMappings, dbFloorMappings, null, savedMerges);
  if (laborData.length > 0) {
    const laborWs = XLSX.utils.json_to_sheet(laborData);
    laborWs['!cols'] = [
      { wch: 6 },  // SEC
      { wch: 8 },  // ACT
      { wch: 10 }, // COST HEAD
      { wch: 25 }, // DESCRIPTION
      { wch: 12 }, // Drawing
      { wch: 15 }, // System
      { wch: 10 }, // Floor
      { wch: 10 }, // Zone
      { wch: 20 }, // Material Spec
      { wch: 12 }, // Item Type
      { wch: 30 }, // Material Description
      { wch: 20 }, // Item Name
      { wch: 15 }, // Size
      { wch: 10 }, // Quantity
      { wch: 10 }, // Hours
      { wch: 12 }, // Labor Dollars
      { wch: 30 }, // Adjustment
    ];
    XLSX.utils.book_append_sheet(wb, laborWs, 'Labor Report');
  }

  // Material Report tab (detailed line items)
  const materialData = prepareMaterialReportData(items);
  if (materialData.length > 0) {
    const materialWs = XLSX.utils.json_to_sheet(materialData);
    materialWs['!cols'] = [
      { wch: 15 }, // Material Code
      { wch: 25 }, // Code Description
      { wch: 12 }, // Drawing
      { wch: 15 }, // System
      { wch: 10 }, // Floor
      { wch: 10 }, // Zone
      { wch: 20 }, // Material Spec
      { wch: 12 }, // Item Type
      { wch: 30 }, // Material Description
      { wch: 20 }, // Item Name
      { wch: 15 }, // Size
      { wch: 10 }, // Quantity
      { wch: 12 }, // List Price
      { wch: 14 }, // Material Dollars
    ];
    XLSX.utils.book_append_sheet(wb, materialWs, 'Material Report');
  }

  // Summary tab — use adjustedLaborSummary if available (matches Budget Packet)
  let laborSummaryRows: { costCode: string; description: string; hours: number; laborDollars: number; itemCount: number }[];
  if (budgetAdjustments?.adjustedLaborSummary && Object.keys(budgetAdjustments.adjustedLaborSummary).length > 0) {
    laborSummaryRows = Object.values(budgetAdjustments.adjustedLaborSummary)
      .filter(item => Math.abs(item.hours ?? 0) >= 0.05)
      .map(item => ({
        costCode: item.code,
        description: item.description,
        hours: item.hours,
        laborDollars: item.dollars,
        itemCount: 0, // not available from adjusted summary
      }));
  } else {
    laborSummaryRows = aggregateLaborByCostCode(items, floorMappings, { buildingMappings, dbFloorMappings });
  }
  const materialSummary = aggregateMaterialByCostCode(items);

  // Build contingency lines — must match Budget Packet exactly
  const contingencyLines: Array<[string, string, number]> = [];

  if (budgetAdjustments?.foremanBonusEnabled && (budgetAdjustments.foremanBonusDollars ?? 0) > 0) {
    contingencyLines.push([
      'GC 0000 FCNT',
      `FIELD BONUS CONTINGENCY ${budgetAdjustments.foremanBonusPercent}% - STRIP OF FIELD LABOR`,
      Math.round(budgetAdjustments.foremanBonusDollars * 100) / 100,
    ]);
  }

  if (budgetAdjustments?.laborRateContingencyEnabled && (budgetAdjustments.lrcnAmount ?? 0) > 0) {
    contingencyLines.push([
      '01 0000 LRCN',
      'LABOR RATE CONTINGENCY',
      Math.round(budgetAdjustments.lrcnAmount * 100) / 100,
    ]);
  }

  // GC 0FAB CONT — math lives in computeGcFabCont() (single source of truth).
  {
    const gcFabContAmount = computeGcFabCont(budgetAdjustments);
    if (gcFabContAmount > 0) {
      contingencyLines.push([
        'GC 0FAB CONT',
        'UNBUDGETED SHOP HOUR VOLUME CONTINGENCY',
        gcFabContAmount,
      ]);
    }
  }

  // GC 0FLD CONT — math lives in computeGcFldCont() (single source of truth).
  {
    const gcFldContAmount = computeGcFldCont(budgetAdjustments);
    if (gcFldContAmount > 0) {
      contingencyLines.push([
        'GC 0FLD CONT',
        'UNBUDGETED FIELD HOUR VOLUME CONTINGENCY',
        gcFldContAmount,
      ]);
    }
  }

  if (budgetAdjustments?.fabLrcnEnabled && (budgetAdjustments.fabLrcnAmount ?? 0) > 0) {
    contingencyLines.push([
      'MA 0FAB LRCN',
      'FAB LABOR RATE CONTINGENCY',
      Math.round(budgetAdjustments.fabLrcnAmount * 100) / 100,
    ]);
  }

  const rawMaterialTotal = materialSummary.reduce((s, m) => s + m.materialDollars, 0);
  const contingencyTotal = contingencyLines.reduce((s, l) => s + l[2], 0);
  const totalMaterialAudit = rawMaterialTotal + contingencyTotal;

  const summaryData = [
    ['LABOR SUMMARY BY COST CODE'],
    ['Cost Code', 'Description', 'Hours', 'Labor $', 'Items'],
    ...laborSummaryRows.map(l => [l.costCode, l.description, Math.round(l.hours), Math.round(l.laborDollars * 100) / 100, l.itemCount || '']),
    [],
    ['MATERIAL SUMMARY BY COST CODE'],
    ['Cost Code', 'Description', 'Material $', 'Items'],
    ...materialSummary.map(m => [m.costCode, m.description, Math.round(m.materialDollars * 100) / 100, m.itemCount]),
    ...(contingencyLines.length > 0 ? [
      [],
      ['CONTINGENCY LINES'],
      ['Cost Code', 'Description', 'Amount'],
      ...contingencyLines.map(l => [l[0], l[1], l[2]]),
    ] : []),
    [],
    ['TOTALS'],
    ['Total Labor Hours:', Math.round(laborSummaryRows.reduce((s, l) => s + l.hours, 0))],
    ['Total Labor $:', Math.round(laborSummaryRows.reduce((s, l) => s + l.laborDollars, 0) * 100) / 100],
    ['Total Material $ (ex. contingency):', Math.round(rawMaterialTotal * 100) / 100],
    ['Total Contingency $:', Math.round(contingencyTotal * 100) / 100],
    ['Total Material $ (inc. contingency):', Math.round(totalMaterialAudit * 100) / 100],
    ['GRAND TOTAL $:', Math.round((laborSummaryRows.reduce((s, l) => s + l.laborDollars, 0) + totalMaterialAudit) * 100) / 100],
  ];

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Adjustment Log tab
  const adjustmentLogData: any[][] = [
    ['ADJUSTMENT LOG'],
    ['Action Type', 'Source Code(s)', 'Source Hours', 'Target Code', 'Final Hours', 'Applied At'],
  ];

  if (savedMerges.length > 0 && budgetAdjustments?.adjustedLaborSummary) {
    const adjSummary = budgetAdjustments.adjustedLaborSummary;
    savedMerges.forEach(merge => {
      let actionType = 'Merge';
      let sourceCode = `${merge.sec_code} * ${merge.cost_head}`;
      let sourceHours = '';
      let targetCode = `${merge.sec_code} ${merge.merged_act} ${merge.cost_head}`;
      let finalHours = '';

      if (merge.reassign_to_head) {
        actionType = merge.reassign_to_head === '__keep__' ? 'Keep' : 'Reassign';
        targetCode = merge.reassign_to_head === '__keep__'
          ? 'Kept as-is'
          : `${merge.sec_code} ${merge.merged_act} ${merge.reassign_to_head}`;
        const targetEntry = merge.reassign_to_head !== '__keep__' ? adjSummary[`${merge.sec_code} ${merge.merged_act} ${merge.reassign_to_head}`] : null;
        finalHours = targetEntry ? String(Math.round(targetEntry.hours)) : '';
      } else if (merge.redistribute_adjustments && Object.keys(merge.redistribute_adjustments).length > 0) {
        actionType = 'Redistribute';
        const redist = merge.redistribute_adjustments;
        sourceHours = Object.entries(redist).map(([act, hrs]) => `${act}: ${hrs}h`).join(', ');
        targetCode = `${merge.sec_code} (redistributed) ${merge.cost_head}`;
        finalHours = String(Math.round(Object.values(redist).reduce((s, h) => s + (h as number), 0)));
      } else {
        const targetEntry = adjSummary[targetCode];
        finalHours = targetEntry ? String(Math.round(targetEntry.hours)) : '';
      }

      adjustmentLogData.push([actionType, sourceCode, sourceHours, targetCode, finalHours, new Date().toISOString().split('T')[0]]);
    });
  } else {
    adjustmentLogData.push(['No adjustments applied', '', '', '', '', '']);
  }

  const adjustmentWs = XLSX.utils.aoa_to_sheet(adjustmentLogData);
  adjustmentWs['!cols'] = [
    { wch: 14 }, // Action Type
    { wch: 25 }, // Source Code(s)
    { wch: 20 }, // Source Hours
    { wch: 25 }, // Target Code
    { wch: 12 }, // Final Hours
    { wch: 14 }, // Applied At
  ];
  XLSX.utils.book_append_sheet(wb, adjustmentWs, 'Adjustment Log');

  // Generate filename
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Audit_Report_${projectInfo.jobNumber.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, filename);

  return {
    laborItems: laborData.length,
    materialItems: materialData.length,
    totalItems: items.length
  };
}

// ============================================================================
// CONTINGENCY HELPERS — single source of truth shared by export + UI readout
// ============================================================================

/**
 * Compute GC 0FAB CONT dollar amount — unbudgeted shop hour volume contingency.
 * Returns 0 if LRCN is disabled, inputs are missing, or the gap is non-positive.
 * SINGLE SOURCE OF TRUTH used by both Budget Packet, Audit Report, and the
 * Bid Reconciliation readout in BudgetAdjustmentsPanel. Do not duplicate this math.
 */
export function computeGcFabCont(ba: BudgetAdjustments | null | undefined): number {
  if (!ba?.laborRateContingencyEnabled) return 0;
  const bidShopHours = ba.bidRates?.shop?.hours || 0;
  const budgetFabHours = ba.totalFabHours || 0;
  const shopBidRate = ba.shopRate || 0;
  if (bidShopHours <= 0 || budgetFabHours <= 0 || shopBidRate <= 0) return 0;
  const amount = (bidShopHours - budgetFabHours) * shopBidRate;
  return amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

/**
 * Compute GC 0FLD CONT dollar amount — unbudgeted field hour volume contingency.
 * Foreman hours are added back to the budget side to prevent double-counting
 * with FCNT (which already strips those hours and recognizes them on the material side).
 * Returns 0 if LRCN is disabled, inputs are missing, or the gap is non-positive.
 * SINGLE SOURCE OF TRUTH used by both Budget Packet, Audit Report, and the
 * Bid Reconciliation readout in BudgetAdjustmentsPanel. Do not duplicate this math.
 */
export function computeGcFldCont(ba: BudgetAdjustments | null | undefined): number {
  if (!ba?.laborRateContingencyEnabled) return 0;
  const bidFieldHours =
    (ba.bidRates?.straightTime?.hours || 0) +
    (ba.bidRates?.shiftTime?.hours || 0) +
    (ba.bidRates?.overtime?.hours || 0) +
    (ba.bidRates?.doubleTime?.hours || 0);
  const budgetFieldHours = ba.totalFieldHours || 0;
  const foremanHours = ba.foremanBonusHours || 0;
  const budgetRateVal = ba.budgetRate || 0;
  const effectiveBudgetFieldHours = budgetFieldHours + foremanHours;
  if (bidFieldHours <= 0 || effectiveBudgetFieldHours <= 0 || budgetRateVal <= 0) return 0;
  const amount = (bidFieldHours - effectiveBudgetFieldHours) * budgetRateVal;
  return amount > 0 ? Math.round(amount * 100) / 100 : 0;
}
