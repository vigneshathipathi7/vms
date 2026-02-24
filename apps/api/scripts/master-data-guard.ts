/**
 * Master Data Lock Utility
 * =========================
 * 
 * Provides protection for master data (geographic locations) in production.
 * 
 * Environment Variables:
 * - MASTER_DATA_LOCK=true    → Enable protection (production)
 * - BYPASS_MASTER_DATA_LOCK=true → Allow import scripts to bypass
 * 
 * Usage in import scripts:
 * ```typescript
 * import { assertMasterDataUnlocked } from './master-data-guard';
 * 
 * // At script start:
 * assertMasterDataUnlocked('Village Import');
 * ```
 */

/**
 * Master data models that are protected in production
 */
export const MASTER_DATA_MODELS = [
  'District',
  'Taluk',
  'Village',
  'Ward',
  'AssemblyConstituency',
  'ParliamentaryConstituency',
  'PollingBooth',
] as const;

export type MasterDataModel = typeof MASTER_DATA_MODELS[number];

/**
 * Check if master data is currently locked
 * @returns true if locked and cannot be modified
 */
export function isMasterDataLocked(): boolean {
  const isLocked = process.env.MASTER_DATA_LOCK === 'true';
  const isBypassed = process.env.BYPASS_MASTER_DATA_LOCK === 'true';
  return isLocked && !isBypassed;
}

/**
 * Check if bypass is active (for logging purposes)
 */
export function isBypassActive(): boolean {
  return process.env.BYPASS_MASTER_DATA_LOCK === 'true';
}

/**
 * Assert that master data is unlocked. Throws if locked.
 * Use at the start of import scripts.
 * 
 * @param operation - Description of the operation for error message
 * @throws Error if master data is locked without bypass
 */
export function assertMasterDataUnlocked(operation: string = 'Operation'): void {
  if (isMasterDataLocked()) {
    throw new Error(
      `MASTER DATA IS LOCKED. ${operation} not permitted.\n` +
      `To proceed, set: BYPASS_MASTER_DATA_LOCK=true\n` +
      `Example: BYPASS_MASTER_DATA_LOCK=true npx ts-node script.ts`
    );
  }
  
  if (isBypassActive()) {
    console.log(`⚠️  Master data bypass active for: ${operation}`);
  }
}

/**
 * Print master data lock status
 */
export function printMasterDataStatus(): void {
  const locked = process.env.MASTER_DATA_LOCK === 'true';
  const bypassed = process.env.BYPASS_MASTER_DATA_LOCK === 'true';
  
  console.log('🔒 MASTER DATA LOCK STATUS:');
  console.log('-'.repeat(40));
  console.log(`   MASTER_DATA_LOCK:        ${locked ? 'ENABLED' : 'disabled'}`);
  console.log(`   BYPASS_MASTER_DATA_LOCK: ${bypassed ? 'ACTIVE' : 'inactive'}`);
  console.log(`   Effective Status:        ${isMasterDataLocked() ? '🔴 LOCKED' : '🟢 UNLOCKED'}`);
  console.log('');
}
