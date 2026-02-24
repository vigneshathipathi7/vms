/**
 * Tamil Nadu LGD Village Data Import Script
 * ==========================================
 * 
 * Extracts village data from village_eng.pdf (380 pages, 12,000+ villages)
 * and imports into the database with proper District/Block(Taluk) matching.
 * 
 * PDF Format (each row):
 * - LGD District Code (numeric)
 * - District Name
 * - LGD Block Code (numeric)
 * - Block Name
 * - LGD Village Code (numeric)
 * - Village Name
 * 
 * Example: 528 KANCHEEPURAM 6482 KANCHEEPURAM 223994 Angambakkam
 * 
 * USAGE:
 *   BYPASS_MASTER_DATA_LOCK=true npx ts-node --transpile-only scripts/extract-and-import-tn-villages.ts
 * 
 * Requirements:
 *   - pdf-parse package
 *   - District and Taluk data must be imported first
 *   - PDF file at: /home/saro/vms/village_eng.pdf
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Enable master data bypass for this import script
process.env.BYPASS_MASTER_DATA_LOCK = 'true';

const prisma = new PrismaClient();

// ============================================================================
// TYPES
// ============================================================================

interface ExtractedVillage {
  districtLgdCode: string;
  districtName: string;
  blockLgdCode: string;
  blockName: string;
  villageLgdCode: string;
  villageName: string;
  lineNumber: number;
}

interface ImportStats {
  totalExtracted: number;
  totalImported: number;
  totalSkipped: number;
  districtNotFound: number;
  blockNotFound: number;
  duplicates: number;
  errors: string[];
}

// ============================================================================
// PDF EXTRACTION
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PDFParse } = require('pdf-parse');

async function extractVillagesFromPdf(pdfPath: string): Promise<ExtractedVillage[]> {
  console.log('📄 Loading PDF...');
  
  const dataBuffer = fs.readFileSync(pdfPath);
  console.log(`   File size: ${(dataBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  
  // Use PDFParse class API (v2)
  const parser = new PDFParse({ data: dataBuffer });
  const pdfData = await parser.getText();
  console.log(`   Pages: ${pdfData.numpages}`);
  console.log(`   Text length: ${pdfData.text.length} characters`);
  
  const villages: ExtractedVillage[] = [];
  const lines = pdfData.text.split('\n');
  
  console.log(`   Total lines: ${lines.length}`);
  console.log('');
  console.log('🔍 Parsing village data...');
  
  // Pattern to match village rows
  // Format: DistrictCode DistrictName BlockCode BlockName VillageCode VillageName
  // Example: 528 KANCHEEPURAM 6482 KANCHEEPURAM 223994 Angambakkam
  // Also handles: 528 KANCHEEPURAM 6482 KANCHEEPURAM 223995 Angambakkam (Elur)
  
  // Regex pattern to extract data
  // Matches: <district_code> <district_name> <block_code> <block_name> <village_code> <village_name>
  const rowPattern = /^(\d+)\s+([A-Z][A-Z\s\-\.]+?)\s+(\d+)\s+([A-Z][A-Z\s\-\.]+?)\s+(\d+)\s+(.+)$/i;
  
  let lineNumber = 0;
  let headerSkipped = 0;
  let emptyLines = 0;
  let invalidLines = 0;
  
  for (const rawLine of lines) {
    lineNumber++;
    const line = rawLine.trim();
    
    // Skip empty lines
    if (!line) {
      emptyLines++;
      continue;
    }
    
    // Skip header lines
    if (
      line.includes('LGD District Code') ||
      line.includes('District Name') ||
      line.includes('Block Code') ||
      line.includes('Village Code') ||
      line.includes('Page') ||
      line.includes('Census') ||
      line.includes('Serial') ||
      line.includes('Sl.No') ||
      line.startsWith('Note:') ||
      line.startsWith('Source:') ||
      /^[\d\s]+$/.test(line) // Pure numbers (page numbers, etc.)
    ) {
      headerSkipped++;
      continue;
    }
    
    // Try to match the pattern
    const match = line.match(rowPattern);
    
    if (match) {
      const [, districtCode, districtName, blockCode, blockName, villageCode, villageName] = match;
      
      // Validate codes are numeric
      if (!/^\d+$/.test(districtCode) || !/^\d+$/.test(blockCode) || !/^\d+$/.test(villageCode)) {
        invalidLines++;
        continue;
      }
      
      villages.push({
        districtLgdCode: districtCode.trim(),
        districtName: normalizeLocationName(districtName),
        blockLgdCode: blockCode.trim(),
        blockName: normalizeLocationName(blockName),
        villageLgdCode: villageCode.trim(),
        villageName: normalizeVillageName(villageName),
        lineNumber,
      });
    } else {
      // Try alternative parsing for lines with extra spaces or different formatting
      const parts = line.split(/\s{2,}/); // Split by 2+ spaces
      
      if (parts.length >= 6) {
        // Try to parse from parts
        const numericParts = parts.filter(p => /^\d+$/.test(p.trim()));
        
        if (numericParts.length >= 3) {
          // Find positions of numeric parts
          const districtCodeIdx = parts.findIndex(p => /^\d+$/.test(p.trim()));
          if (districtCodeIdx >= 0 && districtCodeIdx + 5 < parts.length) {
            villages.push({
              districtLgdCode: parts[districtCodeIdx].trim(),
              districtName: normalizeLocationName(parts[districtCodeIdx + 1] || ''),
              blockLgdCode: parts[districtCodeIdx + 2]?.trim() || '',
              blockName: normalizeLocationName(parts[districtCodeIdx + 3] || ''),
              villageLgdCode: parts[districtCodeIdx + 4]?.trim() || '',
              villageName: normalizeVillageName(parts.slice(districtCodeIdx + 5).join(' ')),
              lineNumber,
            });
          } else {
            invalidLines++;
          }
        } else {
          invalidLines++;
        }
      } else {
        // Could be a continuation line or header, skip
        invalidLines++;
      }
    }
  }
  
  console.log(`   Headers/metadata skipped: ${headerSkipped}`);
  console.log(`   Empty lines: ${emptyLines}`);
  console.log(`   Invalid/unparsed lines: ${invalidLines}`);
  console.log(`   Villages extracted: ${villages.length}`);
  
  return villages;
}

// ============================================================================
// NAME NORMALIZATION
// ============================================================================

function normalizeLocationName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-\.]/g, '');
}

function normalizeVillageName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    // Title case
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    // Clean special characters but keep parentheses
    .replace(/[^\w\s\-\.\(\)]/g, '');
}

// ============================================================================
// DISTRICT/BLOCK NAME MAPPING
// ============================================================================

// Common name variations between PDF and database
const DISTRICT_ALIASES: Record<string, string> = {
  'KANCHEEPURAM': 'Kanchipuram',
  'KANCHIPURAM': 'Kanchipuram',
  'KANNIYAKUMARI': 'Kanyakumari',
  'KANYAKUMARI': 'Kanyakumari',
  'THE NILGIRIS': 'Nilgiris',
  'NILGIRIS': 'Nilgiris',
  'THIRUVALLUR': 'Tiruvallur',
  'TIRUVALLUR': 'Tiruvallur',
  'THIRUVARUR': 'Tiruvarur',
  'TIRUVARUR': 'Tiruvarur',
  'THIRUCHIRAPPALLI': 'Tiruchirappalli',
  'TIRUCHIRAPPALLI': 'Tiruchirappalli',
  'TRICHY': 'Tiruchirappalli',
  'THIRUNELVELI': 'Tirunelveli',
  'TIRUNELVELI': 'Tirunelveli',
  'THIRUVANNAMALAI': 'Tiruvannamalai',
  'TIRUVANNAMALAI': 'Tiruvannamalai',
  'THIRUPATHUR': 'Tirupathur',
  'TIRUPATHUR': 'Tirupathur',
  'THIRUPPUR': 'Tiruppur',
  'TIRUPPUR': 'Tiruppur',
  'THOOTHUKKUDI': 'Thoothukudi',
  'THOOTHUKUDI': 'Thoothukudi',
  'TUTICORIN': 'Thoothukudi',
  'VIRUDHUNAGAR': 'Virudhunagar',
  'SIVAGANGAI': 'Sivaganga',
  'SIVAGANGA': 'Sivaganga',
  'VILLUPURAM': 'Viluppuram',
  'VILUPPURAM': 'Viluppuram',
  'VILUPURAM': 'Viluppuram',  // Single L variant from PDF
  'PUDUKOTTAI': 'Pudukkottai',
  'PUDUKKOTTAI': 'Pudukkottai',
  'RAMANATHAPURAM': 'Ramanathapuram',
  'RAMNAD': 'Ramanathapuram',
  'NAGAPATTINAM': 'Nagapattinam',
  'NAGAPPATTINAM': 'Nagapattinam',
};

function mapDistrictName(pdfName: string): string {
  const normalized = pdfName.toUpperCase().trim();
  if (DISTRICT_ALIASES[normalized]) {
    return DISTRICT_ALIASES[normalized];
  }
  // Title case conversion
  return pdfName
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// DATABASE IMPORT
// ============================================================================

async function importVillages(villages: ExtractedVillage[]): Promise<ImportStats> {
  const stats: ImportStats = {
    totalExtracted: villages.length,
    totalImported: 0,
    totalSkipped: 0,
    districtNotFound: 0,
    blockNotFound: 0,
    duplicates: 0,
    errors: [],
  };
  
  console.log('');
  console.log('📊 Loading existing location data...');
  
  // Load all districts and taluks for matching
  const districts = await prisma.district.findMany({
    select: { id: true, name: true, lgdCode: true },
  });
  
  const taluks = await prisma.taluk.findMany({
    select: { id: true, name: true, lgdCode: true, districtId: true, isLgdBlock: true },
  });
  
  // Count LGD blocks vs revenue taluks
  const lgdBlockCount = taluks.filter(t => t.isLgdBlock).length;
  const revenueTalukCount = taluks.filter(t => !t.isLgdBlock).length;
  
  // Create lookup maps
  const districtByName = new Map<string, { id: string; name: string }>();
  const districtByLgd = new Map<string, { id: string; name: string }>();
  
  for (const d of districts) {
    districtByName.set(d.name.toLowerCase(), d);
    if (d.lgdCode) {
      districtByLgd.set(d.lgdCode, d);
    }
  }
  
  const talukByNameAndDistrict = new Map<string, { id: string; name: string }>();
  const talukByLgd = new Map<string, { id: string; name: string }>();
  
  for (const t of taluks) {
    const key = `${t.districtId}:${t.name.toLowerCase()}`;
    talukByNameAndDistrict.set(key, t);
    if (t.lgdCode) {
      talukByLgd.set(t.lgdCode, t);
    }
  }
  
  // Check for existing villages to avoid duplicates
  const existingVillages = await prisma.village.findMany({
    select: { lgdCode: true },
    where: { lgdCode: { not: null } },
  });
  
  const existingLgdCodes = new Set(existingVillages.map(v => v.lgdCode!));
  
  console.log(`   Districts in DB: ${districts.length}`);
  console.log(`   Taluks in DB: ${taluks.length} (Revenue: ${revenueTalukCount}, LGD Blocks: ${lgdBlockCount})`);
  console.log(`   Existing villages with LGD codes: ${existingVillages.length}`);
  console.log('');
  console.log('🚀 Starting import...');
  
  // Prepare batches
  const BATCH_SIZE = 1000;
  const villagesToCreate: Array<{
    name: string;
    lgdCode: string;
    talukId: string;
    isActive: boolean;
  }> = [];
  
  const notFoundDistricts = new Set<string>();
  const notFoundBlocks = new Set<string>();
  
  for (const village of villages) {
    // Skip if already exists
    if (existingLgdCodes.has(village.villageLgdCode)) {
      stats.duplicates++;
      stats.totalSkipped++;
      continue;
    }
    
    // Find district
    let district = districtByLgd.get(village.districtLgdCode);
    
    if (!district) {
      // Try by name (with alias mapping)
      const mappedName = mapDistrictName(village.districtName);
      district = districtByName.get(mappedName.toLowerCase());
    }
    
    if (!district) {
      // Try fuzzy match
      const normalizedPdfName = village.districtName.toLowerCase().replace(/[^a-z]/g, '');
      for (const [dbName, d] of districtByName) {
        const normalizedDbName = dbName.replace(/[^a-z]/g, '');
        if (normalizedDbName === normalizedPdfName || 
            normalizedDbName.includes(normalizedPdfName) ||
            normalizedPdfName.includes(normalizedDbName)) {
          district = d;
          break;
        }
      }
    }
    
    if (!district) {
      if (!notFoundDistricts.has(village.districtName)) {
        notFoundDistricts.add(village.districtName);
        stats.errors.push(`District not found: ${village.districtName} (LGD: ${village.districtLgdCode})`);
      }
      stats.districtNotFound++;
      stats.totalSkipped++;
      continue;
    }
    
    // Find taluk/block
    let taluk = talukByLgd.get(village.blockLgdCode);
    
    if (!taluk) {
      // Try by name and district
      const blockNameNormalized = village.blockName.toLowerCase().replace(/\s+/g, ' ').trim();
      const key = `${district.id}:${blockNameNormalized}`;
      taluk = talukByNameAndDistrict.get(key);
    }
    
    if (!taluk) {
      // Try fuzzy match within the district
      const normalizedBlockName = village.blockName.toLowerCase().replace(/[^a-z]/g, '');
      for (const [key, t] of talukByNameAndDistrict) {
        if (!key.startsWith(district.id + ':')) continue;
        const talukName = key.split(':')[1].replace(/[^a-z]/g, '');
        if (talukName === normalizedBlockName || 
            talukName.includes(normalizedBlockName) ||
            normalizedBlockName.includes(talukName)) {
          taluk = t;
          break;
        }
      }
    }
    
    if (!taluk) {
      const blockKey = `${village.districtName}:${village.blockName}`;
      if (!notFoundBlocks.has(blockKey)) {
        notFoundBlocks.add(blockKey);
        stats.errors.push(`Block not found: ${village.blockName} in ${village.districtName} (LGD: ${village.blockLgdCode})`);
      }
      stats.blockNotFound++;
      stats.totalSkipped++;
      continue;
    }
    
    // Prepare village for creation
    villagesToCreate.push({
      name: village.villageName,
      lgdCode: village.villageLgdCode,
      talukId: taluk.id,
      isActive: true,
    });
    
    // Add to existing set to prevent duplicates within the import
    existingLgdCodes.add(village.villageLgdCode);
  }
  
  console.log(`   Villages to create: ${villagesToCreate.length}`);
  console.log(`   Skipped (duplicates): ${stats.duplicates}`);
  console.log(`   Skipped (district not found): ${stats.districtNotFound}`);
  console.log(`   Skipped (block not found): ${stats.blockNotFound}`);
  console.log('');
  
  // Batch insert
  if (villagesToCreate.length > 0) {
    console.log('💾 Inserting villages in batches...');
    
    let batchNumber = 0;
    for (let i = 0; i < villagesToCreate.length; i += BATCH_SIZE) {
      batchNumber++;
      const batch = villagesToCreate.slice(i, i + BATCH_SIZE);
      
      try {
        // Use createMany with skipDuplicates for safety
        const result = await prisma.village.createMany({
          data: batch,
          skipDuplicates: true,
        });
        
        stats.totalImported += result.count;
        
        const progress = Math.round((i + batch.length) / villagesToCreate.length * 100);
        console.log(`   Batch ${batchNumber}: ${result.count} inserted (${progress}% complete)`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        stats.errors.push(`Batch ${batchNumber} failed: ${errorMsg}`);
        console.error(`   ❌ Batch ${batchNumber} failed: ${errorMsg}`);
        
        // Try individual inserts for this batch
        console.log(`   🔄 Retrying batch ${batchNumber} with individual inserts...`);
        for (const village of batch) {
          try {
            await prisma.village.upsert({
              where: { lgdCode: village.lgdCode },
              create: village,
              update: {}, // Don't update if exists
            });
            stats.totalImported++;
          } catch (upsertError) {
            // Skip individual failures (likely duplicates)
            stats.totalSkipped++;
          }
        }
      }
    }
  }
  
  return stats;
}

// ============================================================================
// VERIFICATION
// ============================================================================

async function verifyImport(): Promise<void> {
  console.log('');
  console.log('✅ VERIFICATION');
  console.log('='.repeat(60));
  
  const totalVillages = await prisma.village.count();
  const villagesWithLgd = await prisma.village.count({
    where: { lgdCode: { not: null } },
  });
  
  // Get taluk breakdown
  const totalTaluks = await prisma.taluk.count();
  const lgdBlockTaluks = await prisma.taluk.count({ where: { isLgdBlock: true } });
  const revenueTaluks = await prisma.taluk.count({ where: { isLgdBlock: false } });
  
  const villagesByDistrict = await prisma.village.groupBy({
    by: ['talukId'],
    _count: { id: true },
  });
  
  // Get district-level counts
  const taluks = await prisma.taluk.findMany({
    select: { id: true, districtId: true, district: { select: { name: true } } },
  });
  
  const districtCounts: Record<string, number> = {};
  for (const taluk of taluks) {
    const villageCount = villagesByDistrict.find(v => v.talukId === taluk.id)?._count.id || 0;
    const districtName = taluk.district.name;
    districtCounts[districtName] = (districtCounts[districtName] || 0) + villageCount;
  }
  
  console.log('');
  console.log('📊 VILLAGE COUNTS BY DISTRICT:');
  console.log('-'.repeat(40));
  
  const sortedDistricts = Object.entries(districtCounts).sort((a, b) => b[1] - a[1]);
  for (const [district, count] of sortedDistricts) {
    if (count > 0) {
      console.log(`   ${district.padEnd(25)} ${count}`);
    }
  }
  
  console.log('');
  console.log('📈 SUMMARY:');
  console.log('-'.repeat(40));
  console.log(`   Total Taluks in DB:        ${totalTaluks}`);
  console.log(`     - Revenue Taluks:        ${revenueTaluks}`);
  console.log(`     - LGD Blocks:            ${lgdBlockTaluks}`);
  console.log(`   Total villages in DB:      ${totalVillages}`);
  console.log(`   Villages with LGD codes:   ${villagesWithLgd}`);
  console.log(`   Districts with villages:   ${sortedDistricts.filter(d => d[1] > 0).length}`);
  
  if (totalVillages >= 12000) {
    console.log('');
    console.log('🎉 SUCCESS: Village count meets expected threshold (12,000+)');
  } else {
    console.log('');
    console.log(`⚠️  WARNING: Village count (${totalVillages}) is below expected threshold (12,000+)`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('TAMIL NADU LGD VILLAGE DATA IMPORT');
  console.log('='.repeat(60));
  console.log('');
  
  const pdfPath = '/home/saro/vms/village_eng.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF file not found: ${pdfPath}`);
    console.error('   Please place village_eng.pdf in the project root directory.');
    process.exit(1);
  }
  
  try {
    // Step 1: Extract villages from PDF
    const villages = await extractVillagesFromPdf(pdfPath);
    
    if (villages.length === 0) {
      console.error('❌ No villages extracted from PDF');
      process.exit(1);
    }
    
    // Show sample data
    console.log('');
    console.log('📋 SAMPLE DATA (first 5 villages):');
    console.log('-'.repeat(60));
    for (const v of villages.slice(0, 5)) {
      console.log(`   ${v.districtName} > ${v.blockName} > ${v.villageName} (LGD: ${v.villageLgdCode})`);
    }
    
    // Step 2: Import to database
    const stats = await importVillages(villages);
    
    // Step 3: Print results
    console.log('');
    console.log('='.repeat(60));
    console.log('IMPORT RESULTS');
    console.log('='.repeat(60));
    console.log(`   Total extracted from PDF: ${stats.totalExtracted}`);
    console.log(`   Successfully imported:    ${stats.totalImported}`);
    console.log(`   Skipped:                  ${stats.totalSkipped}`);
    console.log(`     - Duplicates:           ${stats.duplicates}`);
    console.log(`     - District not found:   ${stats.districtNotFound}`);
    console.log(`     - Block not found:      ${stats.blockNotFound}`);
    
    if (stats.errors.length > 0) {
      console.log('');
      console.log('⚠️  ERRORS (first 20):');
      console.log('-'.repeat(40));
      for (const error of stats.errors.slice(0, 20)) {
        console.log(`   ${error}`);
      }
      if (stats.errors.length > 20) {
        console.log(`   ... and ${stats.errors.length - 20} more errors`);
      }
    }
    
    // Step 4: Verify
    await verifyImport();
    
    // Step 5: Record import version
    await prisma.locationDatasetVersion.create({
      data: {
        source: 'lgd-village-pdf-import',
        version: '1.0.0',
        metadata: {
          pdfFile: 'village_eng.pdf',
          totalExtracted: stats.totalExtracted,
          totalImported: stats.totalImported,
          totalSkipped: stats.totalSkipped,
          importDate: new Date().toISOString(),
        },
      },
    });
    
    console.log('');
    console.log('📦 Import version recorded.');
    
  } catch (error) {
    console.error('');
    console.error('❌ IMPORT FAILED');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
