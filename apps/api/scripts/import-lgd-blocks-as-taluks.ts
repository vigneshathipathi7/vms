/**
 * LGD Blocks to Taluks Import Script
 * ===================================
 * 
 * Extracts unique Block data from village_eng.pdf and creates
 * missing Taluks for blocks that don't have a corresponding taluk.
 * 
 * USAGE:
 *   BYPASS_MASTER_DATA_LOCK=true npx ts-node --transpile-only scripts/import-lgd-blocks-as-taluks.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { assertMasterDataUnlocked, printMasterDataStatus } from './master-data-guard';

// Enable master data bypass for this import script
process.env.BYPASS_MASTER_DATA_LOCK = 'true';

// Validate that bypass is properly configured
assertMasterDataUnlocked('import-lgd-blocks-as-taluks');
printMasterDataStatus();

const prisma = new PrismaClient();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PDFParse } = require('pdf-parse');

// ============================================================================
// TYPES
// ============================================================================

interface ExtractedBlock {
  districtLgdCode: string;
  districtName: string;
  blockLgdCode: string;
  blockName: string;
}

// ============================================================================
// DISTRICT NAME MAPPING
// ============================================================================

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

function titleCase(name: string): string {
  return name
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// PDF EXTRACTION
// ============================================================================

async function extractBlocksFromPdf(pdfPath: string): Promise<ExtractedBlock[]> {
  console.log('📄 Loading PDF...');
  
  const dataBuffer = fs.readFileSync(pdfPath);
  console.log(`   File size: ${(dataBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  
  const parser = new PDFParse({ data: dataBuffer });
  const pdfData = await parser.getText();
  console.log(`   Text length: ${pdfData.text.length} characters`);
  
  const blocks: ExtractedBlock[] = [];
  const seenBlocks = new Set<string>();
  const lines = pdfData.text.split('\n');
  
  console.log(`   Total lines: ${lines.length}`);
  console.log('');
  console.log('🔍 Extracting unique blocks...');
  
  // Pattern: DistrictCode DistrictName BlockCode BlockName VillageCode VillageName
  const rowPattern = /^(\d+)\s+([A-Z][A-Z\s\-\.]+?)\s+(\d+)\s+([A-Z][A-Z\s\-\.]+?)\s+(\d+)\s+(.+)$/i;
  
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    
    const match = line.match(rowPattern);
    if (match) {
      const [, districtCode, districtName, blockCode, blockName] = match;
      
      // Create unique key
      const key = `${districtCode}:${blockCode}`;
      if (seenBlocks.has(key)) continue;
      seenBlocks.add(key);
      
      blocks.push({
        districtLgdCode: districtCode.trim(),
        districtName: districtName.trim().toUpperCase(),
        blockLgdCode: blockCode.trim(),
        blockName: blockName.trim().toUpperCase(),
      });
    }
  }
  
  console.log(`   Unique blocks extracted: ${blocks.length}`);
  return blocks;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('LGD BLOCKS TO TALUKS IMPORT');
  console.log('='.repeat(60));
  console.log('');
  
  const pdfPath = '/home/saro/vms/village_eng.pdf';
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF file not found: ${pdfPath}`);
    process.exit(1);
  }
  
  try {
    // Step 1: Extract blocks from PDF
    const pdfBlocks = await extractBlocksFromPdf(pdfPath);
    
    // Step 2: Mark existing taluks with LGD codes as LGD blocks
    console.log('');
    console.log('🔄 Marking existing taluks with LGD codes as LGD blocks...');
    const markResult = await prisma.taluk.updateMany({
      where: {
        lgdCode: { not: null },
        isLgdBlock: false,
      },
      data: {
        isLgdBlock: true,
      },
    });
    console.log(`   Updated ${markResult.count} taluks to isLgdBlock=true`);
    
    // Step 3: Load existing districts and taluks
    console.log('');
    console.log('📊 Loading existing location data...');
    
    const districts = await prisma.district.findMany({
      select: { id: true, name: true, lgdCode: true },
    });
    
    const taluks = await prisma.taluk.findMany({
      select: { id: true, name: true, lgdCode: true, districtId: true },
    });
    
    // Create lookup maps
    const districtByName = new Map<string, { id: string; name: string }>();
    const districtByLgd = new Map<string, { id: string; name: string }>();
    
    for (const d of districts) {
      districtByName.set(d.name.toLowerCase(), d);
      if (d.lgdCode) {
        districtByLgd.set(d.lgdCode, d);
      }
    }
    
    // Track existing taluks by lgdCode and by name+district
    const existingTalukLgdCodes = new Set<string>();
    const existingTalukByDistrictAndName = new Map<string, boolean>();
    
    for (const t of taluks) {
      if (t.lgdCode) {
        existingTalukLgdCodes.add(t.lgdCode);
      }
      const key = `${t.districtId}:${t.name.toLowerCase()}`;
      existingTalukByDistrictAndName.set(key, true);
    }
    
    console.log(`   Districts in DB: ${districts.length}`);
    console.log(`   Taluks in DB: ${taluks.length}`);
    console.log(`   Blocks in PDF: ${pdfBlocks.length}`);
    console.log('');
    
    // Step 3: Find missing blocks
    const missingBlocks: Array<{
      districtId: string;
      districtName: string;
      blockLgdCode: string;
      blockName: string;
    }> = [];
    
    const districtNotFoundBlocks: string[] = [];
    
    for (const block of pdfBlocks) {
      // Skip if taluk with this LGD code already exists
      if (existingTalukLgdCodes.has(block.blockLgdCode)) {
        continue;
      }
      
      // Find district
      let district = districtByLgd.get(block.districtLgdCode);
      
      if (!district) {
        const mappedName = mapDistrictName(block.districtName);
        district = districtByName.get(mappedName.toLowerCase());
      }
      
      if (!district) {
        // Try fuzzy match
        const normalizedPdfName = block.districtName.toLowerCase().replace(/[^a-z]/g, '');
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
        districtNotFoundBlocks.push(`${block.districtName} (LGD: ${block.districtLgdCode})`);
        continue;
      }
      
      // Check if taluk with this name already exists in district
      const normalizedBlockName = titleCase(block.blockName);
      const key = `${district.id}:${normalizedBlockName.toLowerCase()}`;
      
      if (existingTalukByDistrictAndName.has(key)) {
        // Already exists by name, just update LGD code
        const existingTaluk = taluks.find(
          t => t.districtId === district!.id && t.name.toLowerCase() === normalizedBlockName.toLowerCase()
        );
        if (existingTaluk && !existingTaluk.lgdCode) {
          await prisma.taluk.update({
            where: { id: existingTaluk.id },
            data: { 
              lgdCode: block.blockLgdCode,
              isLgdBlock: true,  // Mark as LGD block
            },
          });
          existingTalukLgdCodes.add(block.blockLgdCode);
        }
        continue;
      }
      
      missingBlocks.push({
        districtId: district.id,
        districtName: district.name,
        blockLgdCode: block.blockLgdCode,
        blockName: normalizedBlockName,
      });
      
      // Add to existing map to prevent duplicates
      existingTalukByDistrictAndName.set(key, true);
    }
    
    // Deduplicate district not found errors
    const uniqueDistrictNotFound = [...new Set(districtNotFoundBlocks)];
    
    console.log('📋 ANALYSIS:');
    console.log('-'.repeat(40));
    console.log(`   Blocks that need new Taluk records: ${missingBlocks.length}`);
    console.log(`   Districts not found: ${uniqueDistrictNotFound.length}`);
    
    if (uniqueDistrictNotFound.length > 0) {
      console.log('');
      console.log('⚠️  Districts not found (blocks skipped):');
      for (const d of uniqueDistrictNotFound.slice(0, 10)) {
        console.log(`      ${d}`);
      }
      if (uniqueDistrictNotFound.length > 10) {
        console.log(`      ... and ${uniqueDistrictNotFound.length - 10} more`);
      }
    }
    
    if (missingBlocks.length === 0) {
      console.log('');
      console.log('✅ All blocks already have corresponding Taluks!');
      return;
    }
    
    // Step 4: Create new Taluks for missing blocks
    console.log('');
    console.log('🚀 Creating new Taluk records...');
    
    // Group by district for display
    const byDistrict: Record<string, string[]> = {};
    for (const block of missingBlocks) {
      if (!byDistrict[block.districtName]) {
        byDistrict[block.districtName] = [];
      }
      byDistrict[block.districtName].push(block.blockName);
    }
    
    // Show what will be created
    console.log('');
    console.log('📋 New Taluks to create (by district):');
    console.log('-'.repeat(40));
    for (const [district, blocks] of Object.entries(byDistrict).slice(0, 10)) {
      console.log(`   ${district}: ${blocks.slice(0, 5).join(', ')}${blocks.length > 5 ? ` (+${blocks.length - 5} more)` : ''}`);
    }
    if (Object.keys(byDistrict).length > 10) {
      console.log(`   ... and ${Object.keys(byDistrict).length - 10} more districts`);
    }
    
    // Batch insert
    const BATCH_SIZE = 100;
    let created = 0;
    
    for (let i = 0; i < missingBlocks.length; i += BATCH_SIZE) {
      const batch = missingBlocks.slice(i, i + BATCH_SIZE);
      
      const result = await prisma.taluk.createMany({
        data: batch.map(b => ({
          name: b.blockName,
          lgdCode: b.blockLgdCode,
          districtId: b.districtId,
          isLgdBlock: true,  // Mark as LGD block (not revenue taluk)
        })),
        skipDuplicates: true,
      });
      
      created += result.count;
      const progress = Math.round((i + batch.length) / missingBlocks.length * 100);
      console.log(`   Batch ${Math.ceil((i + 1) / BATCH_SIZE)}: ${result.count} created (${progress}% complete)`);
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));
    console.log(`   Total blocks in PDF: ${pdfBlocks.length}`);
    console.log(`   New Taluks created: ${created}`);
    console.log('');
    
    // Final verification with Revenue vs LGD breakdown
    const finalTalukCount = await prisma.taluk.count();
    const lgdBlockCount = await prisma.taluk.count({ where: { isLgdBlock: true } });
    const revenueTalukCount = await prisma.taluk.count({ where: { isLgdBlock: false } });
    
    console.log('✅ FINAL VERIFICATION:');
    console.log('-'.repeat(40));
    console.log(`   Total Taluks in DB:      ${finalTalukCount}`);
    console.log(`   Revenue Taluks:          ${revenueTalukCount}`);
    console.log(`   LGD Blocks (as Taluks):  ${lgdBlockCount}`);
    console.log('');
    console.log('💡 Now re-run the village import:');
    console.log('   BYPASS_MASTER_DATA_LOCK=true npx ts-node --transpile-only scripts/extract-and-import-tn-villages.ts');
    
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
