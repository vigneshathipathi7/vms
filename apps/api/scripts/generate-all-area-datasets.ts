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

const DISTRICT_ALIASES: Record<string, string> = {
  Kanchipuram: 'Kancheepuram',
  Kanyakumari: 'Kanniyakumari',
  Sivaganga: 'Sivagangai',
  Tiruvallur: 'Thiruvallur',
  Villupuram: 'Viluppuram',
};

function canonicalDistrictName(name: string) {
  return DISTRICT_ALIASES[name] ?? name;
}

function main() {
  const force = process.argv.includes('--force');

  const repoRoot = path.resolve(__dirname, '../../..');
  const sourcePath = path.resolve(__dirname, 'import-tn-constituencies.ts');
  const outputDir = path.resolve(__dirname, 'data');

  const source = fs.readFileSync(sourcePath, 'utf-8');
  const rows = parseAssemblyRows(source);

  const byDistrict = new Map<string, AssemblyRow[]>();
  for (const row of rows) {
    const districtName = canonicalDistrictName(row.district);
    const current = byDistrict.get(districtName) ?? [];
    current.push({ ...row, district: districtName });
    byDistrict.set(districtName, current);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  let created = 0;
  let skipped = 0;

  for (const [districtName, districtRows] of Array.from(byDistrict.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const sortedRows = districtRows.sort((a, b) => Number(a.code) - Number(b.code));

    const payload = {
      district: districtName,
      constituencies: sortedRows.map((row) => ({
        name: row.name,
        acCode: row.code,
        urbanAreas: [] as string[],
        ruralVillages: [] as string[],
      })),
    };

    const outputPath = path.resolve(outputDir, `${toSlug(districtName)}-areas-by-assembly.json`);
    if (!force && fs.existsSync(outputPath)) {
      skipped += 1;
      continue;
    }

    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
    created += 1;
  }

  const relativeDir = path.relative(repoRoot, outputDir);
  console.log(`Output dir: ${relativeDir}`);
  console.log(`District datasets created: ${created}`);
  console.log(`District datasets skipped: ${skipped}`);
  console.log(`Total districts covered: ${byDistrict.size}`);
}

main();
