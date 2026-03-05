import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateCandidate(candidateId: string, dryRun: boolean) {
  const admins = await prisma.user.findMany({
    where: { candidateId, role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true },
  });

  if (admins.length === 0) {
    console.log(`- candidate ${candidateId}: no ADMIN found, skipped`);
    return;
  }

  const rootAdminId = admins[0].id;

  const legacyUsers = await prisma.user.findMany({
    where: { candidateId, role: 'SUB_USER' },
    select: {
      id: true,
      username: true,
      managedWardId: true,
      assignedWards: { select: { wardId: true } },
    },
  });

  for (const user of legacyUsers) {
    const assignedWardIds = [...new Set(user.assignedWards.map((entry) => entry.wardId))];
    const inferredRole: UserRole = (assignedWardIds.length > 1 ? 'SUB_ADMIN' : 'SUB_USER') as UserRole;
    const inferredManagedWardId = user.managedWardId ?? assignedWardIds[0] ?? null;

    if (!dryRun) {
      await prisma.$executeRaw`
        UPDATE "User"
        SET role = ${inferredRole}::"UserRole",
            "parentUserId" = ${rootAdminId},
            "managedWardId" = ${inferredManagedWardId}
        WHERE id = ${user.id}
      `;

      if (inferredManagedWardId && assignedWardIds.length === 0) {
        await prisma.subUserWard.create({
          data: {
            userId: user.id,
            wardId: inferredManagedWardId,
          },
        }).catch(() => undefined);
      }
    }

    console.log(
      `  ${dryRun ? '[dry-run] ' : ''}${user.username}: SUB_USER -> ${inferredRole}, parent=${rootAdminId}, ward=${inferredManagedWardId ?? '-'}${assignedWardIds.length > 1 ? `, scope=${assignedWardIds.length} wards` : ''}`,
    );
  }

  // Ensure admin has no parent
  if (!dryRun) {
    await prisma.$executeRaw`
      UPDATE "User"
      SET "parentUserId" = NULL
      WHERE "candidateId" = ${candidateId}
        AND role = 'ADMIN'::"UserRole"
    `;
  }

  console.log(`- candidate ${candidateId}: migrated ${legacyUsers.length} users`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const candidates = await prisma.candidate.findMany({
    select: { id: true, fullName: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Starting hierarchy migration${dryRun ? ' (dry-run)' : ''} for ${candidates.length} candidates`);

  for (const candidate of candidates) {
    console.log(`Candidate: ${candidate.fullName} (${candidate.id})`);
    await migrateCandidate(candidate.id, dryRun);
  }

  console.log('Hierarchy migration complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
