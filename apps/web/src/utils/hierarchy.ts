import { ElectionType } from '../types/api';

/**
 * Hierarchy configuration based on election type.
 * Controls which location fields are visible/required in the UI.
 */
export interface HierarchyConfig {
  // Field visibility
  showState: boolean;
  showDistrict: boolean;
  showTaluk: boolean;
  showVillage: boolean;
  showConstituency: boolean;
  showAssemblyConstituency: boolean;
  showWard: boolean;
  
  // Field labels (customize based on election type)
  stateLabel: string;
  constituencyLabel: string;
  wardLabel: string;
  
  // Required fields for validation
  requiredFields: string[];
}

/**
 * Get hierarchy configuration based on election type.
 * 
 * LOCAL_BODY: District → Taluk → Village → Ward
 * ASSEMBLY: District → Assembly Constituency → Ward/Booth
 * PARLIAMENT: State → Parliamentary Constituency → Assembly Constituency → Ward/Booth
 */
export function getHierarchyConfig(electionType: ElectionType): HierarchyConfig {
  switch (electionType) {
    case 'LOCAL_BODY':
      return {
        showState: false,
        showDistrict: true,
        showTaluk: true,
        showVillage: true,
        showConstituency: false,
        showAssemblyConstituency: false,
        showWard: true,
        stateLabel: 'State',
        constituencyLabel: 'Constituency',
        wardLabel: 'Ward',
        requiredFields: ['talukId', 'villageId', 'wardId'],
      };
      
    case 'ASSEMBLY':
      return {
        showState: false,
        showDistrict: true,
        showTaluk: false,
        showVillage: false,
        showConstituency: true,
        showAssemblyConstituency: false,
        showWard: true,
        stateLabel: 'State',
        constituencyLabel: 'Assembly Constituency',
        wardLabel: 'Booth/Ward',
        requiredFields: ['constituency', 'wardId'],
      };
      
    case 'PARLIAMENT':
      return {
        showState: true,
        showDistrict: false,
        showTaluk: false,
        showVillage: false,
        showConstituency: true,
        showAssemblyConstituency: true,
        showWard: true,
        stateLabel: 'State',
        constituencyLabel: 'Parliamentary Constituency',
        wardLabel: 'Booth/Ward',
        requiredFields: ['state', 'constituency', 'assemblyConstituency', 'wardId'],
      };
      
    default:
      // Default to LOCAL_BODY
      return getHierarchyConfig('LOCAL_BODY');
  }
}

/**
 * Validate voter form data based on election type hierarchy.
 */
export function validateHierarchy(
  data: Record<string, unknown>,
  electionType: ElectionType
): { valid: boolean; errors: string[] } {
  const config = getHierarchyConfig(electionType);
  const errors: string[] = [];
  
  for (const field of config.requiredFields) {
    if (!data[field]) {
      errors.push(`${field} is required for ${electionType} elections`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get display labels for hierarchy breadcrumb.
 */
export function getHierarchyLabels(electionType: ElectionType): string[] {
  switch (electionType) {
    case 'LOCAL_BODY':
      return ['District', 'Taluk', 'Village', 'Ward'];
    case 'ASSEMBLY':
      return ['District', 'Assembly Constituency', 'Booth'];
    case 'PARLIAMENT':
      return ['State', 'Parliamentary Constituency', 'Assembly Constituency', 'Booth'];
    default:
      return ['District', 'Taluk', 'Village', 'Ward'];
  }
}
