/**
 * Location Seed Script
 * 
 * Seeds location data from district-wards.json.
 * 
 * USAGE:
 *   BYPASS_MASTER_DATA_LOCK=true npx ts-node prisma/seed-locations.ts
 * 
 * NOTE: Master data is protected. The BYPASS flag is required.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Enable master data bypass for this seed script
process.env.BYPASS_MASTER_DATA_LOCK = 'true';

const prisma = new PrismaClient();

async function main() {
    const dataPath = path.resolve(__dirname, '../../web/src/data/district-wards.json');
    const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    for (const [districtName, ulbs] of Object.entries(rawData)) {
        const district = await prisma.district.upsert({
            where: { name: districtName },
            update: {},
            create: { name: districtName },
        });

        for (const [ulbName, wardsVal] of Object.entries(ulbs as Record<string, any>)) {
            let type = 'MUNICIPALITY';
            let nameStr = ulbName;

            if (ulbName.toLowerCase().includes('corporation')) {
                type = 'CORPORATION';
            } else if (ulbName.toLowerCase().includes('town panchayat')) {
                type = 'TOWN_PANCHAYAT';
            }

            nameStr = nameStr.replace(/(Corporation|Municipality|Town Panchayat)$/i, '').trim();
            if (!nameStr) nameStr = ulbName;

            let localBody = await prisma.localBody.findFirst({
                where: { districtId: district.id, name: nameStr },
            });

            if (!localBody) {
                localBody = await prisma.localBody.create({
                    data: {
                        name: nameStr,
                        districtId: district.id,
                    },
                });
            }

            let numWards = 0;
            if (typeof wardsVal === 'number') {
                numWards = wardsVal;
            } else if (Array.isArray(wardsVal)) {
                numWards = wardsVal.length;
            } else if (typeof wardsVal === 'string') {
                numWards = parseInt(wardsVal, 10);
                if (isNaN(numWards)) numWards = 0;
            }

            const existingWards = await prisma.ward.count({
                where: { localBodyId: localBody.id },
            });

            if (existingWards < numWards) {
                const wardsToCreate = [];
                for (let i = 1; i <= numWards; i++) {
                    wardsToCreate.push({
                        localBodyId: localBody.id,
                        wardNumber: `Ward ${i}`,
                    });
                }

                // Just blindly create many, ignoring collisions for simplicity in seed.
                try {
                    await prisma.ward.createMany({
                        data: wardsToCreate,
                        skipDuplicates: true,
                    });
                } catch (err: unknown) {
                    console.error(`Failed pushing wards for ${nameStr}:`, err instanceof Error ? err.message : err);
                }
            }

        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log('Location seeding complete.');
    });
