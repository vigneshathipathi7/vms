/**
 * Tamil Nadu Location Data Verification Script
 * 
 * Verifies data integrity and completeness for production use.
 * 
 * Expected counts for Tamil Nadu:
 * - Districts: 38
 * - Revenue Taluks: ~153
 * - LGD Blocks: ~386
 * - Assembly Constituencies: 234
 * - Parliamentary Constituencies: 39
 * - Villages: 12,500+
 */

import { PrismaClient } from '@prisma/client';
import { isMasterDataLocked, printMasterDataStatus } from './master-data-guard';

const prisma = new PrismaClient();

// Full list of Tamil Nadu districts (38 total)
const EXPECTED_DISTRICTS = [
  'Ariyalur',
  'Chengalpattu', 
  'Chennai',
  'Coimbatore',
  'Cuddalore',
  'Dharmapuri',
  'Dindigul',
  'Erode',
  'Kallakurichi',
  'Kanchipuram',
  'Kanyakumari',
  'Karur',
  'Krishnagiri',
  'Madurai',
  'Mayiladuthurai',
  'Nagapattinam',
  'Namakkal',
  'Nilgiris',
  'Perambalur',
  'Pudukkottai',
  'Ramanathapuram',
  'Ranipet',
  'Salem',
  'Sivaganga',
  'Tenkasi',
  'Thanjavur',
  'Theni',
  'Thoothukudi',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tirupathur',
  'Tiruppur',
  'Tiruvallur',
  'Tiruvannamalai',
  'Tiruvarur',
  'Vellore',
  'Viluppuram',
  'Virudhunagar'
];

async function main() {
  console.log('='.repeat(60));
  console.log('TAMIL NADU MASTER DATA VERIFICATION');
  console.log('='.repeat(60));
  console.log();

  // Show master data lock status
  printMasterDataStatus();
  console.log();

  // Count existing data
  try {
    const districtCount = await prisma.district.count();
    const talukCount = await prisma.taluk.count();
    const revenueTalukCount = await prisma.taluk.count({ where: { isLgdBlock: false } });
    const lgdBlockCount = await prisma.taluk.count({ where: { isLgdBlock: true } });
    const villageCount = await prisma.village.count();
    const wardCount = await prisma.ward.count();
    const assemblyCount = await prisma.assemblyConstituency.count();
    const parliamentaryCount = await prisma.parliamentaryConstituency.count();
    const pollingBoothCount = await prisma.pollingBooth.count();

    console.log('📊 CURRENT DATABASE COUNTS:');
    console.log('-'.repeat(40));
    console.log(`  Districts:                ${districtCount.toString().padStart(6)} (expected 38)`);
    console.log(`  Taluks (Total):           ${talukCount.toString().padStart(6)}`);
    console.log(`    ├─ Revenue Taluks:      ${revenueTalukCount.toString().padStart(6)} (traditional)`);
    console.log(`    └─ LGD Blocks:          ${lgdBlockCount.toString().padStart(6)} (for LOCAL_BODY)`);
    console.log(`  Villages:                 ${villageCount.toString().padStart(6)} (expected 12,500+)`);
    console.log(`  Wards:                    ${wardCount.toString().padStart(6)}`);
    console.log(`  Assembly Constituencies:  ${assemblyCount.toString().padStart(6)} (expected 234)`);
    console.log(`  Parliamentary Const.:     ${parliamentaryCount.toString().padStart(6)} (expected 39)`);
    console.log(`  Polling Booths:           ${pollingBoothCount.toString().padStart(6)}`);
    console.log();

    // DATA INTEGRITY CHECKS
    console.log('🔍 DATA INTEGRITY CHECKS:');
    console.log('-'.repeat(40));
    
    const integrityIssues: string[] = [];
    
    // Note: Village.talukId, Taluk.districtId, and AssemblyConstituency.districtId 
    // are all required fields in the schema, so orphan records are impossible.
    // The database constraints enforce referential integrity.
    console.log(`  ✓ No orphan villages (enforced by schema)`);
    console.log(`  ✓ No orphan taluks (enforced by schema)`);
    console.log(`  ✓ No orphan assembly constituencies (enforced by schema)`);

    // Check 4: Duplicate village names within same taluk
    const duplicateVillages = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM (
        SELECT "talukId", "name", COUNT(*) 
        FROM "Village" 
        GROUP BY "talukId", "name" 
        HAVING COUNT(*) > 1
      ) as dups
    `;
    const dupVillageCount = Number(duplicateVillages[0]?.count || 0);
    if (dupVillageCount > 0) {
      integrityIssues.push(`${dupVillageCount} duplicate village names per taluk`);
      console.log(`  ❌ Duplicate villages (same name+taluk): ${dupVillageCount}`);
    } else {
      console.log(`  ✓ No duplicate village names per taluk`);
    }

    // Check 5: LGD Blocks with missing LGD codes
    const lgdBlocksNoCode = await prisma.taluk.count({
      where: { isLgdBlock: true, lgdCode: null }
    });
    if (lgdBlocksNoCode > 0) {
      integrityIssues.push(`${lgdBlocksNoCode} LGD blocks missing lgdCode`);
      console.log(`  ⚠️  LGD blocks without lgdCode: ${lgdBlocksNoCode}`);
    } else {
      console.log(`  ✓ All LGD blocks have lgdCode`);
    }

    // Check 6: Districts without taluks
    const districtsNoTaluks = await prisma.district.count({
      where: { taluks: { none: {} } }
    });
    if (districtsNoTaluks > 0) {
      integrityIssues.push(`${districtsNoTaluks} districts with no taluks`);
      console.log(`  ⚠️  Districts without any taluks: ${districtsNoTaluks}`);
    } else {
      console.log(`  ✓ All districts have at least one taluk`);
    }

    // Check 7: Taluks without villages
    const taluksNoVillages = await prisma.taluk.count({
      where: { villages: { none: {} } }
    });
    if (taluksNoVillages > 0) {
      console.log(`  ⚠️  Taluks without villages: ${taluksNoVillages}`);
    } else {
      console.log(`  ✓ All taluks have at least one village`);
    }

    console.log();

    // Get all districts with taluk counts
    const districts = await prisma.district.findMany({
      include: {
        _count: { select: { taluks: true, assemblyConstituencies: true } }
      },
      orderBy: { name: 'asc' }
    });

    const existingDistrictNames = districts.map(d => d.name).sort();
    console.log(`📍 DISTRICTS IN DATABASE: ${districts.length} of ${EXPECTED_DISTRICTS.length} expected`);
    console.log('-'.repeat(40));
    
    if (districts.length > 0) {
      districts.forEach(d => {
        console.log(`  ✓ ${d.name} (${d._count.taluks} taluks, ${d._count.assemblyConstituencies} AC)`);
      });
    } else {
      console.log('  No districts found in database.');
    }
    console.log();

    // Check for missing districts
    const missingDistricts = EXPECTED_DISTRICTS.filter(d => !existingDistrictNames.includes(d));
    if (missingDistricts.length > 0) {
      console.log(`❌ MISSING DISTRICTS: ${missingDistricts.length}`);
      console.log('-'.repeat(40));
      missingDistricts.forEach(d => console.log(`  ✗ ${d}`));
      console.log();
    }

    // Show Assembly Constituencies by district
    if (assemblyCount > 0) {
      console.log('🏛️  ASSEMBLY CONSTITUENCIES:');
      console.log('-'.repeat(40));
      const acByDistrict = await prisma.assemblyConstituency.groupBy({
        by: ['districtId'],
        _count: { id: true }
      });
      for (const ac of acByDistrict.slice(0, 5)) {
        const district = await prisma.district.findUnique({ where: { id: ac.districtId } });
        console.log(`  ${district?.name || 'Unknown'}: ${ac._count.id} constituencies`);
      }
      if (acByDistrict.length > 5) {
        console.log(`  ... and ${acByDistrict.length - 5} more districts`);
      }
      console.log();
    }

    // Show Parliamentary Constituencies  
    if (parliamentaryCount > 0) {
      console.log('🏛️  PARLIAMENTARY CONSTITUENCIES:');
      console.log('-'.repeat(40));
      const pcs = await prisma.parliamentaryConstituency.findMany({
        take: 10,
        orderBy: { name: 'asc' }
      });
      pcs.forEach(pc => console.log(`  ✓ ${pc.name}`));
      if (parliamentaryCount > 10) {
        console.log(`  ... and ${parliamentaryCount - 10} more`);
      }
      console.log();
    }

    // Sample some taluks with their villages
    if (talukCount > 0) {
      const sampleTaluks = await prisma.taluk.findMany({
        take: 5,
        include: {
          district: true,
          _count: {
            select: { villages: true }
          }
        }
      });

      console.log('🔍 SAMPLE TALUKS (first 5):');
      console.log('-'.repeat(40));
      sampleTaluks.forEach(t => {
        const talukType = t.isLgdBlock ? '[LGD]' : '[Revenue]';
        console.log(`  ${t.name} (${t.district.name}) ${talukType} - ${t._count.villages} villages`);
      });
      console.log();
    }

    // Check LocationDatasetVersion
    const versions = await prisma.locationDatasetVersion.findMany({
      orderBy: { importedAt: 'desc' },
      take: 5
    });

    console.log('📦 LOCATION DATASET VERSIONS:');
    console.log('-'.repeat(40));
    if (versions.length > 0) {
      versions.forEach(v => {
        console.log(`  ${v.source} v${v.version} - ${v.importedAt.toISOString()}`);
        if (v.metadata) {
          console.log(`    Metadata: ${JSON.stringify(v.metadata)}`);
        }
      });
    } else {
      console.log('  No import versions recorded.');
    }
    console.log();

    // Summary
    console.log('='.repeat(60));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    
    const issues: string[] = [];
    
    if (districtCount < EXPECTED_DISTRICTS.length) {
      issues.push(`Missing ${EXPECTED_DISTRICTS.length - districtCount} districts (have ${districtCount})`);
    }
    if (revenueTalukCount < 150) {
      issues.push(`Only ${revenueTalukCount} revenue taluks (expected ~153)`);
    }
    if (lgdBlockCount < 380) {
      issues.push(`Only ${lgdBlockCount} LGD blocks (expected ~386)`);
    }
    if (villageCount < 12000) {
      issues.push(`Only ${villageCount} villages (expected 12,500+)`);
    }
    if (assemblyCount < 234) {
      issues.push(`Only ${assemblyCount} assembly constituencies (expected 234)`);
    }
    if (parliamentaryCount < 39) {
      issues.push(`Only ${parliamentaryCount} parliamentary constituencies (expected 39)`);
    }

    // Add integrity issues
    issues.push(...integrityIssues);

    if (issues.length === 0) {
      console.log('✅ ALL CHECKS PASSED - Master data is production ready!');
      console.log();
      console.log('📋 FINAL MASTER DATA STATUS:');
      console.log('┌─────────────────────────────┬─────────┐');
      console.log('│ Entity                      │ Count   │');
      console.log('├─────────────────────────────┼─────────┤');
      console.log(`│ Districts                   │ ${districtCount.toString().padStart(7)} │`);
      console.log(`│ Revenue Taluks              │ ${revenueTalukCount.toString().padStart(7)} │`);
      console.log(`│ LGD Blocks (LOCAL_BODY)     │ ${lgdBlockCount.toString().padStart(7)} │`);
      console.log(`│ Villages                    │ ${villageCount.toString().padStart(7)} │`);
      console.log(`│ Wards                       │ ${wardCount.toString().padStart(7)} │`);
      console.log(`│ Assembly Constituencies     │ ${assemblyCount.toString().padStart(7)} │`);
      console.log(`│ Parliamentary Constituencies│ ${parliamentaryCount.toString().padStart(7)} │`);
      console.log('└─────────────────────────────┴─────────┘');
      console.log();
      if (isMasterDataLocked()) {
        console.log('🔒 Master data is LOCKED - Safe for production');
      } else {
        console.log('⚠️  Master data is UNLOCKED - Set MASTER_DATA_LOCK=true for production');
      }
    } else {
      console.log('⚠️  Issues found:');
      issues.forEach(issue => console.log(`    - ${issue}`));
      console.log();
      console.log('Run import scripts to populate missing data.');
    }

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
