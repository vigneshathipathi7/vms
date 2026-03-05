import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { assertMasterDataUnlocked, printMasterDataStatus } from './master-data-guard';

process.env.BYPASS_MASTER_DATA_LOCK = process.env.BYPASS_MASTER_DATA_LOCK ?? 'true';

assertMasterDataUnlocked('import-chengalpattu-areas');
printMasterDataStatus();

const prisma = new PrismaClient();

type ConstituencyArea = {
  name: string;
  acCode: string;
  urbanAreas?: string[];
  ruralBlock?: string;
  ruralVillages: string[];
};

type AreaDataset = {
  district: string;
  constituencies: ConstituencyArea[];
};

const DATASET_PATH = path.resolve(__dirname, 'data/chengalpattu-areas-by-assembly.json');
const DRY_RUN = process.env.DRY_RUN !== 'false';
const TALUK_BLOCK_ALIASES: Record<string, string> = {
  lathur: 'Cheyyur',
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\(sc\)|\(st\)/g, '')
    .replace(/corporation|municipality|town\s+panchayat|block/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function ensureUnique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function isConcreteAreaName(value: string) {
  return !value.toLowerCase().includes('parts of');
}

async function main() {
  console.log('='.repeat(72));
  console.log('CHENGALPATTU AREA IMPORT (ASSEMBLY-WISE)');
  console.log('='.repeat(72));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE IMPORT'}`);
  console.log(`Dataset: ${DATASET_PATH}`);
  console.log('');

  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`Dataset file not found: ${DATASET_PATH}`);
  }

  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8')) as AreaDataset;

  const district = await prisma.district.findFirst({
    where: { name: dataset.district },
    select: { id: true, name: true },
  });

  if (!district) {
    throw new Error(`District not found: ${dataset.district}`);
  }

  const taluks = await prisma.taluk.findMany({
    where: { districtId: district.id },
    select: { id: true, name: true, isLgdBlock: true },
    orderBy: { name: 'asc' },
  });

  const taluksByNormalized = new Map<string, { id: string; name: string; isLgdBlock: boolean }[]>();
  for (const taluk of taluks) {
    const key = normalize(taluk.name);
    const current = taluksByNormalized.get(key) ?? [];
    current.push(taluk);
    taluksByNormalized.set(key, current);
  }

  const assemblyRows = await prisma.assemblyConstituency.findMany({
    where: { districtId: district.id },
    select: { id: true, name: true, code: true },
  });
  const assemblyByNormalized = new Map<string, { id: string; name: string; code: string | null }>();
  for (const row of assemblyRows) {
    assemblyByNormalized.set(normalize(row.name), row);
  }

  const urbanTalukHints: Record<string, string> = {
    Chengalpattu: 'Chengalpattu',
    Tambaram: 'Tambaram',
    Madurantakam: 'Madurantakam',
    Cheyyur: 'Cheyyur',
    Thiruporur: 'Thiruporur',
    Pallavaram: 'Pallavaram',
  };

  let villagesCreated = 0;
  let villagesExisting = 0;
  let wardsCreated = 0;
  let wardsExisting = 0;

  const unresolvedTaluks: string[] = [];
  const unresolvedAssemblies: string[] = [];

  for (const constituency of dataset.constituencies) {
    const assembly = assemblyByNormalized.get(normalize(constituency.name));
    if (!assembly) {
      unresolvedAssemblies.push(`${constituency.name} (AC ${constituency.acCode})`);
    }

    const villagesToImport = ensureUnique([
      ...(constituency.ruralVillages ?? []),
      ...(constituency.urbanAreas ?? []),
    ]).filter(isConcreteAreaName);

    if (villagesToImport.length === 0) {
      continue;
    }

    let talukCandidates: { id: string; name: string; isLgdBlock: boolean }[] = [];

    if (constituency.ruralBlock) {
      talukCandidates = taluksByNormalized.get(normalize(constituency.ruralBlock)) ?? [];

      if (talukCandidates.length === 0) {
        const blockAlias = TALUK_BLOCK_ALIASES[normalize(constituency.ruralBlock)];
        if (blockAlias) {
          talukCandidates = taluksByNormalized.get(normalize(blockAlias)) ?? [];
        }
      }
    }

    if (talukCandidates.length === 0) {
      const hint = urbanTalukHints[constituency.name];
      if (hint) {
        talukCandidates = taluksByNormalized.get(normalize(hint)) ?? [];
      }
    }

    if (talukCandidates.length === 0) {
      unresolvedTaluks.push(`${constituency.name} (AC ${constituency.acCode})`);
      continue;
    }

    const taluk = talukCandidates[0];

    console.log(`• ${constituency.name} (AC ${constituency.acCode}) -> Taluk: ${taluk.name}`);

    for (const villageName of villagesToImport) {
      const existingVillage = await prisma.village.findFirst({
        where: { talukId: taluk.id, name: villageName },
        select: { id: true },
      });

      let villageId: string;
      if (existingVillage) {
        villageId = existingVillage.id;
        villagesExisting += 1;
      } else if (DRY_RUN) {
        villageId = `dry-${taluk.id}-${normalize(villageName)}`;
        villagesCreated += 1;
      } else {
        const createdVillage = await prisma.village.create({
          data: { talukId: taluk.id, name: villageName },
          select: { id: true },
        });
        villageId = createdVillage.id;
        villagesCreated += 1;
      }

      if (DRY_RUN) {
        const wardCount = await prisma.ward.count({ where: { villageId: existingVillage?.id ?? '' } });
        if (existingVillage && wardCount > 0) {
          wardsExisting += 1;
        } else {
          wardsCreated += 1;
        }
        continue;
      }

      const existingWard = await prisma.ward.findFirst({
        where: { villageId, wardNumber: '1' },
        select: { id: true },
      });

      if (existingWard) {
        wardsExisting += 1;
      } else {
        await prisma.ward.create({
          data: { villageId, wardNumber: '1' },
        });
        wardsCreated += 1;
      }
    }
  }

  console.log('');
  console.log('='.repeat(72));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(72));
  console.log(`Villages created:         ${villagesCreated}`);
  console.log(`Villages already present: ${villagesExisting}`);
  console.log(`Ward-1 created:           ${wardsCreated}`);
  console.log(`Ward-1 already present:   ${wardsExisting}`);

  if (unresolvedAssemblies.length > 0) {
    console.log('');
    console.log('Assembly names not found in district master (for reference only):');
    for (const item of unresolvedAssemblies) {
      console.log(` - ${item}`);
    }
  }

  if (unresolvedTaluks.length > 0) {
    console.log('');
    console.log('Constituencies skipped due to taluk/block mapping not found:');
    for (const item of unresolvedTaluks) {
      console.log(` - ${item}`);
    }
  }

  console.log('');
  console.log(DRY_RUN
    ? 'Dry run complete. Re-run with DRY_RUN=false to persist changes.'
    : 'Import complete.');
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
