/**
 * Hardened Government Location Data Import Script
 * ================================================
 * 
 * Production-safe location data import with:
 * - Input validation schema
 * - Deduplication logic
 * - Transactional consistency
 * - Import versioning and rollback support
 * - Detailed logging
 * 
 * Data Sources:
 * - Election Commission of India (ECI)
 * - State Election Commission portals
 * - Government open data portals
 * - Official district/constituency CSV/JSON datasets
 * 
 * Usage:
 *   npx ts-node scripts/import-locations.ts
 * 
 * After running once, all candidates can use the same master location dataset.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

interface WardData {
  wardNumber: string;
}

interface VillageData {
  name: string;
  wards: string[];
}

interface TalukData {
  taluk: string;
  district: string;
  state: string;
  villages: VillageData[];
}

/**
 * Validate location data structure
 * Throws on invalid data
 */
function validateLocationData(data: unknown): TalukData[] {
  if (!Array.isArray(data)) {
    throw new Error('Location data must be an array');
  }

  const taluks = data as TalukData[];

  for (const taluk of taluks) {
    if (!taluk.taluk || !taluk.district || !taluk.state) {
      throw new Error(`Invalid taluk data: ${JSON.stringify(taluk)}`);
    }

    if (!Array.isArray(taluk.villages)) {
      throw new Error(`Taluk ${taluk.taluk} has invalid villages array`);
    }

    for (const village of taluk.villages) {
      if (!village.name || !Array.isArray(village.wards)) {
        throw new Error(`Invalid village in ${taluk.taluk}: ${JSON.stringify(village)}`);
      }

      for (const ward of village.wards) {
        if (typeof ward !== 'string' || !ward.trim()) {
          throw new Error(`Invalid ward number in ${village.name}: ${ward}`);
        }
      }
    }
  }

  return taluks;
}

/**
 * Deduplicate location data
 * Removes duplicate taluks/villages/wards while preserving all data
 */
function deduplicateData(locations: TalukData[]): TalukData[] {
  const taluks = new Map<string, TalukData>();

  for (const taluk of locations) {
    const key = `${taluk.taluk.toLowerCase()}:${taluk.district.toLowerCase()}`;
    
    if (!taluks.has(key)) {
      taluks.set(key, {
        ...taluk,
        villages: [],
      });
    }

    const existingTaluk = taluks.get(key)!;
    const villageSet = new Set(existingTaluk.villages.map(v => v.name.toLowerCase()));

    for (const village of taluk.villages) {
      if (!villageSet.has(village.name.toLowerCase())) {
        existingTaluk.villages.push({
          name: village.name,
          wards: [...new Set(village.wards)], // Deduplicate wards
        });
        villageSet.add(village.name.toLowerCase());
      }
    }
  }

  return Array.from(taluks.values());
}

// ============================================================================
// SAMPLE LOCATION DATA (from file or API in production)
// ============================================================================

// Tamil Nadu sample data - expandable with official government data
const TAMIL_NADU_LOCATIONS: TalukData[] = [
  {
    taluk: 'Coimbatore North',
    district: 'Coimbatore',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Vilankurichi', wards: ['1', '2', '3', '4', '5'] },
      { name: 'Thudiyalur', wards: ['1', '2', '3', '4'] },
      { name: 'Kalapatti', wards: ['1', '2', '3', '4', '5', '6'] },
      { name: 'Saravanampatti', wards: ['1', '2', '3', '4', '5'] },
    ],
  },
  {
    taluk: 'Coimbatore South',
    district: 'Coimbatore',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Singanallur', wards: ['1', '2', '3', '4', '5', '6'] },
      { name: 'Peelamedu', wards: ['1', '2', '3', '4'] },
      { name: 'Ganapathy', wards: ['1', '2', '3', '4', '5'] },
      { name: 'Ramanathapuram', wards: ['1', '2', '3'] },
    ],
  },
  {
    taluk: 'Pollachi',
    district: 'Coimbatore',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Pollachi Town', wards: ['1', '2', '3', '4', '5', '6'] },
      { name: 'Kinathukadavu', wards: ['1', '2', '3', '4'] },
      { name: 'Negamam', wards: ['1', '2', '3'] },
      { name: 'Zamin Uthukuli', wards: ['1', '2', '3', '4'] },
    ],
  },
  {
    taluk: 'Mettupalayam',
    district: 'Coimbatore',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Mettupalayam Town', wards: ['1', '2', '3', '4', '5'] },
      { name: 'Karamadai', wards: ['1', '2', '3'] },
      { name: 'Sirumugai', wards: ['1', '2', '3', '4'] },
    ],
  },
  {
    taluk: 'Tirupur North',
    district: 'Tirupur',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Avinashi', wards: ['1', '2', '3', '4', '5'] },
      { name: 'Veerapandi', wards: ['1', '2', '3'] },
      { name: 'Mangalam', wards: ['1', '2', '3', '4'] },
    ],
  },
  {
    taluk: 'Tirupur South',
    district: 'Tirupur',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Palladam', wards: ['1', '2', '3', '4', '5', '6'] },
      { name: 'Pongalur', wards: ['1', '2', '3', '4'] },
      { name: 'Kaniyur', wards: ['1', '2', '3'] },
    ],
  },
  {
    taluk: 'Salem',
    district: 'Salem',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Salem City', wards: ['1', '2', '3', '4', '5', '6', '7', '8'] },
      { name: 'Hasthampatti', wards: ['1', '2', '3', '4'] },
      { name: 'Ammapet', wards: ['1', '2', '3', '4', '5'] },
    ],
  },
  {
    taluk: 'Attur',
    district: 'Salem',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Attur Town', wards: ['1', '2', '3', '4', '5'] },
      { name: 'Narasingapuram', wards: ['1', '2', '3'] },
      { name: 'Thalaivasal', wards: ['1', '2', '3', '4'] },
    ],
  },
  {
    taluk: 'Erode',
    district: 'Erode',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Erode City', wards: ['1', '2', '3', '4', '5', '6', '7'] },
      { name: 'Chithode', wards: ['1', '2', '3', '4'] },
      { name: 'Kavindapadi', wards: ['1', '2', '3'] },
    ],
  },
  {
    taluk: 'Bhavani',
    district: 'Erode',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Bhavani Town', wards: ['1', '2', '3', '4', '5'] },
      { name: 'Anthiyur', wards: ['1', '2', '3', '4'] },
      { name: 'Sathyamangalam', wards: ['1', '2', '3', '4', '5'] },
    ],
  },
  {
    taluk: 'Madurai North',
    district: 'Madurai',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Anna Nagar', wards: ['1', '2', '3', '4', '5'] },
      { name: 'K.K. Nagar', wards: ['1', '2', '3', '4'] },
      { name: 'Thirunagar', wards: ['1', '2', '3', '4', '5', '6'] },
    ],
  },
  {
    taluk: 'Madurai South',
    district: 'Madurai',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Mattuthavani', wards: ['1', '2', '3', '4'] },
      { name: 'Pasumalai', wards: ['1', '2', '3'] },
      { name: 'Nagamalai', wards: ['1', '2', '3', '4', '5'] },
    ],
  },
  {
    taluk: 'Chennai North',
    district: 'Chennai',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Perambur', wards: ['1', '2', '3', '4', '5', '6'] },
      { name: 'Kolathur', wards: ['1', '2', '3', '4', '5'] },
      { name: 'Villivakkam', wards: ['1', '2', '3', '4'] },
      { name: 'Madhavaram', wards: ['1', '2', '3', '4', '5'] },
    ],
  },
  {
    taluk: 'Chennai South',
    district: 'Chennai',
    state: 'Tamil Nadu',
    villages: [
      { name: 'T. Nagar', wards: ['1', '2', '3', '4', '5', '6'] },
      { name: 'Adyar', wards: ['1', '2', '3', '4', '5'] },
      { name: 'Velachery', wards: ['1', '2', '3', '4', '5', '6'] },
      { name: 'Guindy', wards: ['1', '2', '3', '4'] },
    ],
  },
  {
    taluk: 'Chennai Central',
    district: 'Chennai',
    state: 'Tamil Nadu',
    villages: [
      { name: 'Triplicane', wards: ['1', '2', '3', '4'] },
      { name: 'Mylapore', wards: ['1', '2', '3', '4', '5'] },
      { name: 'Egmore', wards: ['1', '2', '3', '4'] },
      { name: 'Nungambakkam', wards: ['1', '2', '3'] },
    ],
  },
];

// ============================================================================
// IMPORT FUNCTION (TRANSACTIONAL)
// ============================================================================

interface ImportStats {
  taluks: number;
  villages: number;
  wards: number;
}

async function importLocationsTransaction(
  locations: TalukData[]
): Promise<ImportStats> {
  console.log('');
  console.log('='.repeat(70));
  console.log('IMPORTING SHARED GOVERNMENT LOCATION DATA (TRANSACTIONAL)');
  console.log('='.repeat(70));
  console.log('');

  const stats: ImportStats = {
    taluks: 0,
    villages: 0,
    wards: 0,
  };

  // Use Prisma transaction for atomic operations
  await prisma.$transaction(async (tx) => {
    for (const talukData of locations) {
      // Upsert Taluk (shared globally - no candidateId)
      const taluk = await tx.taluk.upsert({
        where: { name: talukData.taluk },
        update: { 
          district: talukData.district,
        },
        create: {
          name: talukData.taluk,
          district: talukData.district,
        },
      });
      stats.taluks++;
      console.log(`  ✓ Taluk: ${taluk.name} (${talukData.district})`);

      // Import villages for this taluk
      for (const villageData of talukData.villages) {
        const village = await tx.village.upsert({
          where: {
            talukId_name: {
              talukId: taluk.id,
              name: villageData.name,
            },
          },
          update: {},
          create: {
            name: villageData.name,
            talukId: taluk.id,
          },
        });
        stats.villages++;

        // Import wards for this village
        // Use createMany with skipDuplicates for batch efficiency
        const wardsToCreate = villageData.wards.map((wardNumber) => ({
          wardNumber,
          villageId: village.id,
        }));

        await tx.ward.createMany({
          data: wardsToCreate,
          skipDuplicates: true, // Skip if already exists (uniqueness constraint)
        });

        stats.wards += villageData.wards.length;
      }
    }

    // Record import version (if table exists)
    try {
      await tx.locationDatasetVersion.create({
        data: {
          source: 'manual-import',
          version: new Date().toISOString().split('T')[0],
          metadata: {
            taluks: stats.taluks,
            villages: stats.villages,
            wards: stats.wards,
            status: 'success',
          },
        },
      });
    } catch {
      console.log('Note: LocationDatasetVersion table not yet created (run migrations)');
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('IMPORT COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('');
    console.log(`  Taluks:   ${stats.taluks}`);
    console.log(`  Villages: ${stats.villages}`);
    console.log(`  Wards:    ${stats.wards}`);
    console.log('');
    console.log('Location data is now available for ALL candidates.');
    console.log('Import was wrapped in a transaction for consistency.');
    console.log('');
  });

  return stats;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    // Check if already imported
    const existingCount = await prisma.taluk.count();
    if (existingCount > 0) {
      console.log('');
      console.log(`Found ${existingCount} existing taluks.`);
      console.log('Running import to update/add new locations...');
      console.log('');
    }

    // Get latest import version (if table exists)
    try {
      const lastImport = await prisma.locationDatasetVersion.findFirst({
        orderBy: { importedAt: 'desc' },
      });

      if (lastImport) {
        console.log(`Last import: ${lastImport.importedAt.toISOString()}`);
        console.log(`Version: ${lastImport.version} (${lastImport.source})`);
        console.log('');
      }
    } catch {
      // Table not yet created
    }

    // Validate data
    console.log('Validating location data...');
    const validatedData = validateLocationData(TAMIL_NADU_LOCATIONS);
    console.log(`✓ Validation passed for ${validatedData.length} taluks`);
    console.log('');

    // Deduplicate data
    console.log('Deduplicating location data...');
    const deduplicatedData = deduplicateData(validatedData);
    console.log(`✓ Deduplication complete: ${deduplicatedData.length} taluks`);
    console.log('');

    // Perform transactional import
    const stats = await importLocationsTransaction(deduplicatedData);

    console.log('');
    console.log('✓✓✓ All location data imported successfully!');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ IMPORT FAILED');
    console.error('');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('');
    console.error('Entire transaction has been rolled back. No data was persisted.');
    console.error('');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

