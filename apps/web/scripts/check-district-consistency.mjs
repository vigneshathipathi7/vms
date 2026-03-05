import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const districtWardsPath = path.resolve(__dirname, '../src/data/district-wards.json');
const assemblyMapPath = path.resolve(__dirname, '../src/constants/assemblyConstituencies.ts');

function extractAssemblyDistrictKeys(tsSource) {
  const keyRegex = /^\s{2}'([^']+)':\s*\[/gm;
  const keys = [];
  for (const match of tsSource.matchAll(keyRegex)) {
    keys.push(match[1]);
  }
  return keys;
}

function countAssemblyConstituencies(tsSource) {
  const arrayRegex = /^\s{2}'[^']+':\s*\[(.*?)\],\s*$/gms;
  let total = 0;

  for (const match of tsSource.matchAll(arrayRegex)) {
    const listBody = match[1];
    const itemMatches = listBody.match(/'[^']+'/g) ?? [];
    total += itemMatches.length;
  }

  return total;
}

function diff(left, right) {
  return left.filter((item) => !right.includes(item));
}

function main() {
  const districtWards = JSON.parse(fs.readFileSync(districtWardsPath, 'utf-8'));
  const districtKeys = Object.keys(districtWards);

  const assemblyMapSource = fs.readFileSync(assemblyMapPath, 'utf-8');
  const assemblyDistrictKeys = extractAssemblyDistrictKeys(assemblyMapSource);

  if (assemblyDistrictKeys.length === 0) {
    console.error('❌ Could not parse district keys from assemblyConstituencies.ts');
    process.exit(1);
  }

  const missingInAssemblyMap = diff(districtKeys, assemblyDistrictKeys);
  const extraInAssemblyMap = diff(assemblyDistrictKeys, districtKeys);

  if (missingInAssemblyMap.length || extraInAssemblyMap.length) {
    console.error('❌ District key mismatch between district dropdown and assembly map.');
    if (missingInAssemblyMap.length) {
      console.error('   Missing in assembly map:', missingInAssemblyMap.join(', '));
    }
    if (extraInAssemblyMap.length) {
      console.error('   Extra in assembly map:', extraInAssemblyMap.join(', '));
    }
    process.exit(1);
  }

  const totalAssemblies = countAssemblyConstituencies(assemblyMapSource);
  if (totalAssemblies !== 234) {
    console.error(`❌ Assembly constituency count mismatch. Expected 234, got ${totalAssemblies}.`);
    process.exit(1);
  }

  console.log('✅ District consistency check passed.');
  console.log(`   Districts: ${districtKeys.length}`);
  console.log(`   Assembly Constituencies: ${totalAssemblies}`);
}

main();
