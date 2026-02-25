/**
 * Municipality Ward Count Import (Synthetic Ward Records)
 * =======================================================
 *
 * This script imports municipality-level ward counts and creates synthetic
 * ward rows (1..N) under a matched taluk/village for UI completeness.
 *
 * IMPORTANT:
 * - Source CSV does NOT contain ward-wise boundaries or district codes.
 * - This is an approximate import to populate dropdown options.
 * - Ambiguous/unmatched ULB names are skipped and reported.
 *
 * Usage:
 *   BYPASS_MASTER_DATA_LOCK=true npx ts-node --transpile-only scripts/import-municipality-ward-counts.ts
 *
 * Optional env vars:
 *   MUNICIPALITY_WARD_CSV=/absolute/path/to/WARD_DETAILS_IN_MUNICIPALITIES.csv
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { assertMasterDataUnlocked, printMasterDataStatus } from './master-data-guard';

process.env.BYPASS_MASTER_DATA_LOCK = 'true';

assertMasterDataUnlocked('import-municipality-ward-counts');
printMasterDataStatus();

const prisma = new PrismaClient();

type MunicipalityWardRow = {
  grade: string;
  ulbName: string;
  totalWards: number;
};

const NAME_ALIASES: Record<string, string> = {
  chenglepet: 'chengalpattu',
  sathiamangalam: 'sathyamangalam',
  pudukottai: 'pudukkottai',
  villupuram: 'viluppuram',
  theniallinagaram: 'theni allinagaram',
  poonamalle: 'poonamallee',
};

const ULB_MANUAL_MATCH: Record<
  string,
  {
    talukName: string;
    districtName?: string;
  }
> = {
  dindigul: { talukName: 'Dindigul East', districtName: 'Dindigul' },
  maraimalainagar: { talukName: 'Tambaram', districtName: 'Chengalpattu' },
  nagercoil: { talukName: 'Agastheeswaram', districtName: 'Kanyakumari' },
  pallavapuram: { talukName: 'Pallavaram', districtName: 'Chengalpattu' },
  thiruvannamalai: { talukName: 'Tiruvannamalai', districtName: 'Tiruvannamalai' },
  uthagamandalam: { talukName: 'Udhagamandalam', districtName: 'Nilgiris' },
  pammal: { talukName: 'Pallavaram', districtName: 'Chengalpattu' },
  pattukottai: { talukName: 'Pattukkottai', districtName: 'Thanjavur' },
  'theni allinagaram': { talukName: 'Theni', districtName: 'Theni' },
  thiruverkadu: { talukName: 'Poonamallee', districtName: 'Tiruvallur' },
  tirupathur: { talukName: 'Tirupathur', districtName: 'Tirupathur' },
  udumalaipetai: { talukName: 'Udumalpet', districtName: 'Tiruppur' },
  arakonam: { talukName: 'Arakkonam', districtName: 'Ranipet' },
  aruppukottai: { talukName: 'Aruppukkottai', districtName: 'Virudhunagar' },
  colachel: { talukName: 'Kalkulam', districtName: 'Kanyakumari' },
  gudiyatham: { talukName: 'Gudiyattam', districtName: 'Vellore' },
  idappadi: { talukName: 'Edappadi', districtName: 'Salem' },
  kadayanallur: { talukName: 'Kadayanallur', districtName: 'Tenkasi' },
  kallakurichi: { talukName: 'Kallakurichi', districtName: 'Kallakurichi' },
  komarapalayam: { talukName: 'Tiruchengode', districtName: 'Namakkal' },
  manaparai: { talukName: 'Manapparai', districtName: 'Tiruchirappalli' },
  sankarankoil: { talukName: 'Sankarankovil', districtName: 'Tenkasi' },
  sivagangai: { talukName: 'Sivaganga', districtName: 'Sivaganga' },
  tenkasi: { talukName: 'Tenkasi', districtName: 'Tenkasi' },
  thiruthangal: { talukName: 'Sivakasi', districtName: 'Virudhunagar' },
  anakaputhur: { talukName: 'Pallavaram', districtName: 'Chengalpattu' },
  kankeyam: { talukName: 'Kangeyam', districtName: 'Tiruppur' },
  kayalpattinam: { talukName: 'Tiruchendur', districtName: 'Thoothukudi' },
  keelakarai: { talukName: 'Ramanathapuram', districtName: 'Ramanathapuram' },
  koothanallur: { talukName: 'Tiruvarur', districtName: 'Tiruvarur' },
  kuzhithurai: { talukName: 'Vilavancode', districtName: 'Kanyakumari' },
  madurantagam: { talukName: 'Madurantakam', districtName: 'Chengalpattu' },
  melvisharam: { talukName: 'Arcot', districtName: 'Ranipet' },
  narasingapuram: { talukName: 'Attur', districtName: 'Salem' },
  nellikuppam: { talukName: 'Panruti', districtName: 'Cuddalore' },
  nelliyalam: { talukName: 'Gudalur', districtName: 'Nilgiris' },
  padmanabhapuram: { talukName: 'Kalkulam', districtName: 'Kanyakumari' },
  pallipalayam: { talukName: 'Tiruchengode', districtName: 'Namakkal' },
  pernampet: { talukName: 'Pernambut', districtName: 'Vellore' },
  puliangudi: { talukName: 'Puliyangudi', districtName: 'Tenkasi' },
  punjaipuliyampatti: { talukName: 'Sathyamangalam', districtName: 'Erode' },
  sengottai: { talukName: 'Shenkottai', districtName: 'Tenkasi' },
  thiruthani: { talukName: 'Tiruttani', districtName: 'Tiruvallur' },
  thiruvathipuram: { talukName: 'Cheyyar', districtName: 'Tiruvannamalai' },
  thuvakudi: { talukName: 'Thiruverumbur', districtName: 'Tiruchirappalli' },
  walajapettai: { talukName: 'Walajah', districtName: 'Ranipet' },
};

function normalizeName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/municipality|municipal|corporation|town\s+panchayat/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return NAME_ALIASES[normalized] ?? normalized;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  fields.push(current.trim());
  return fields;
}

function parseCsv(filePath: string): MunicipalityWardRow[] {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV is empty or missing data rows');
  }

  const header = parseCsvLine(lines[0]);
  const gradeIndex = header.findIndex((column) => column.toLowerCase() === 'grade');
  const ulbIndex = header.findIndex((column) => column.toLowerCase() === 'name of the ulb');
  const wardsIndex = header.findIndex((column) => column.toLowerCase() === 'total no. of wards');

  if (gradeIndex < 0 || ulbIndex < 0 || wardsIndex < 0) {
    throw new Error('CSV does not contain required columns: Grade, Name of the ULB, Total No. of Wards');
  }

  const parsed: MunicipalityWardRow[] = [];

  for (const rawLine of lines.slice(1)) {
    const columns = parseCsvLine(rawLine);
    const grade = columns[gradeIndex] ?? '';
    const ulbName = columns[ulbIndex] ?? '';
    const wardsRaw = columns[wardsIndex] ?? '';
    const totalWards = Number.parseInt(wardsRaw, 10);

    if (!ulbName || !Number.isFinite(totalWards) || totalWards <= 0) {
      continue;
    }

    parsed.push({
      grade,
      ulbName: ulbName.trim(),
      totalWards,
    });
  }

  return parsed;
}

async function main() {
  const csvPath =
    process.env.MUNICIPALITY_WARD_CSV ?? '/home/saro/Downloads/WARD_DETAILS_IN_MUNICIPALITIES.csv';

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  console.log('='.repeat(72));
  console.log('MUNICIPALITY WARD COUNT IMPORT (SYNTHETIC)');
  console.log('='.repeat(72));
  console.log(`📄 Source CSV: ${csvPath}`);

  const rawRows = parseCsv(csvPath);
  console.log(`📊 Parsed rows: ${rawRows.length}`);

  const dedupedRows = new Map<string, MunicipalityWardRow>();
  const conflictingRows: Array<{ ulbName: string; existingCount: number; incomingCount: number }> = [];

  for (const row of rawRows) {
    const key = normalizeName(row.ulbName);
    const existing = dedupedRows.get(key);

    if (!existing) {
      dedupedRows.set(key, row);
      continue;
    }

    if (existing.totalWards !== row.totalWards) {
      conflictingRows.push({
        ulbName: row.ulbName,
        existingCount: existing.totalWards,
        incomingCount: row.totalWards,
      });
    }
  }

  if (conflictingRows.length > 0) {
    console.log('⚠️ Conflicting duplicate ULB entries detected (skipping conflicting extras):');
    for (const conflict of conflictingRows) {
      console.log(
        `   - ${conflict.ulbName}: counts ${conflict.existingCount} vs ${conflict.incomingCount}`,
      );
    }
  }

  const rows = Array.from(dedupedRows.values());
  console.log(`✅ Unique ULB rows: ${rows.length}`);

  const taluks = await prisma.taluk.findMany({
    select: {
      id: true,
      name: true,
      district: {
        select: {
          name: true,
        },
      },
    },
  });

  const taluksByNormalizedName = new Map<string, typeof taluks>();
  for (const taluk of taluks) {
    const key = normalizeName(taluk.name);
    const existing = taluksByNormalizedName.get(key) ?? [];
    existing.push(taluk);
    taluksByNormalizedName.set(key, existing);
  }

  function resolveTalukMatch(ulbName: string) {
    const normalizedUlbName = normalizeName(ulbName);
    const manual = ULB_MANUAL_MATCH[normalizedUlbName];

    if (manual) {
      const normalizedTaluk = normalizeName(manual.talukName);
      const manualCandidates = taluks.filter(
        (item) =>
          normalizeName(item.name) === normalizedTaluk &&
          (!manual.districtName || item.district.name === manual.districtName),
      );

      if (manualCandidates.length === 1) {
        return manualCandidates[0];
      }

      if (manualCandidates.length > 1 && manual.districtName) {
        const inDistrict = manualCandidates.find(
          (item) => item.district.name === manual.districtName,
        );
        if (inDistrict) {
          return inDistrict;
        }
      }
    }

    const directMatches = taluksByNormalizedName.get(normalizedUlbName) ?? [];
    if (directMatches.length === 1) {
      return directMatches[0];
    }

    return null;
  }

  const unresolved: Array<{ ulbName: string; reason: string }> = [];
  let villagesCreated = 0;
  let wardsCreated = 0;
  let wardsAlreadyPresent = 0;

  for (const row of rows) {
    const matchedTaluk = resolveTalukMatch(row.ulbName);

    if (!matchedTaluk) {
      unresolved.push({ ulbName: row.ulbName, reason: 'No matching taluk mapping found' });
      continue;
    }
    const villageName = row.ulbName;

    let village = await prisma.village.findFirst({
      where: {
        talukId: matchedTaluk.id,
        name: villageName,
      },
      select: { id: true },
    });

    if (!village) {
      village = await prisma.village.create({
        data: {
          talukId: matchedTaluk.id,
          name: villageName,
        },
        select: { id: true },
      });
      villagesCreated += 1;
    }

    const wardPayload = Array.from({ length: row.totalWards }, (_, index) => ({
      villageId: village.id,
      wardNumber: String(index + 1),
    }));

    const createResult = await prisma.ward.createMany({
      data: wardPayload,
      skipDuplicates: true,
    });

    wardsCreated += createResult.count;
    wardsAlreadyPresent += row.totalWards - createResult.count;

    console.log(
      `• ${row.ulbName} (${matchedTaluk.district.name}) -> +${createResult.count}/${row.totalWards} wards`,
    );
  }

  console.log('');
  console.log('='.repeat(72));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(72));
  console.log(`Villages created:         ${villagesCreated}`);
  console.log(`Wards created:            ${wardsCreated}`);
  console.log(`Wards already existed:    ${wardsAlreadyPresent}`);
  console.log(`Unresolved ULB rows:      ${unresolved.length}`);

  if (unresolved.length > 0) {
    console.log('');
    console.log('Unresolved rows (manual mapping needed):');
    for (const item of unresolved) {
      console.log(` - ${item.ulbName}: ${item.reason}`);
    }
  }
}

main()
  .catch((error) => {
    console.error('❌ Import failed');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
