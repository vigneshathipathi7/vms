import * as fs from 'fs';
import * as path from 'path';

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\(sc\)|\(st\)/g, '')
    .replace(/[^a-z0-9]/g, '');
}

type AssemblyRow = {
  name: string;
  code: string;
  district: string;
};

function parseAssemblyRows(source: string): AssemblyRow[] {
  const pattern = /\{\s*name:\s*'([^']+)'\s*,\s*code:\s*'([^']+)'\s*,\s*district:\s*'([^']+)'\s*,/g;
  const rows: AssemblyRow[] = [];
  for (const match of source.matchAll(pattern)) {
    rows.push({
      name: match[1],
      code: match[2],
      district: match[3],
    });
  }
  return rows;
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function main() {
  const districtArg = process.argv[2]?.trim();
  if (!districtArg) {
    console.error('Usage: ts-node scripts/generate-area-dataset.ts "District Name"');
    process.exit(1);
  }

  const repoRoot = path.resolve(__dirname, '../../..');
  const sourcePath = path.resolve(__dirname, 'import-tn-constituencies.ts');
  const outputDir = path.resolve(__dirname, 'data');

  const source = fs.readFileSync(sourcePath, 'utf-8');
  const rows = parseAssemblyRows(source);

  const districtRows = rows
    .filter((row) => normalize(row.district) === normalize(districtArg))
    .sort((a, b) => Number(a.code) - Number(b.code));

  if (districtRows.length === 0) {
    console.error(`No assembly rows found for district: ${districtArg}`);
    process.exit(1);
  }

  const payload = {
    district: districtArg,
    constituencies: districtRows.map((row) => ({
      name: row.name,
      acCode: row.code,
      urbanAreas: [] as string[],
      ruralVillages: [] as string[],
    })),
  };

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.resolve(outputDir, `${toSlug(districtArg)}-areas-by-assembly.json`);

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

  const relativePath = path.relative(repoRoot, outputPath);
  console.log(`Generated: ${relativePath}`);
  console.log(`Constituencies: ${districtRows.length}`);
}

main();
