import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Master data models that are READ-ONLY in production.
 * These models cannot be modified via Prisma operations.
 * All updates must be done via official import scripts with BYPASS_MASTER_DATA_LOCK=true.
 */
const MASTER_DATA_MODELS = [
  'District',
  'Taluk',
  'Village',
  'Ward',
  'AssemblyConstituency',
  'ParliamentaryConstituency',
  'PollingBooth',
];

const WRITE_ACTIONS = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'];

/**
 * Check if master data is locked.
 * MASTER_DATA_LOCK=true enables protection
 * BYPASS_MASTER_DATA_LOCK=true allows bypassing for import scripts
 */
export function isMasterDataLocked(): boolean {
  const isLocked = process.env.MASTER_DATA_LOCK === 'true';
  const isBypassed = process.env.BYPASS_MASTER_DATA_LOCK === 'true';
  return isLocked && !isBypassed;
}

/**
 * Throw if master data is locked. Use in import scripts.
 */
export function assertMasterDataUnlocked(operation: string = 'operation'): void {
  if (isMasterDataLocked()) {
    throw new Error(
      `MASTER DATA IS LOCKED. ${operation} not permitted. ` +
      `Set BYPASS_MASTER_DATA_LOCK=true to proceed.`
    );
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Add middleware to protect master data from modifications
    this.$use(async (params, next) => {
      const model = params.model;
      const action = params.action;

      // Check if this is a write operation on master data
      if (model && MASTER_DATA_MODELS.includes(model) && WRITE_ACTIONS.includes(action)) {
        // Allow bypassing for import scripts (set BYPASS_MASTER_DATA_LOCK=true)
        if (process.env.BYPASS_MASTER_DATA_LOCK === 'true') {
          this.logger.warn(`Master data bypass enabled for ${action} on ${model}`);
          return next(params);
        }

        // Block the operation when MASTER_DATA_LOCK is enabled (production)
        // In development (MASTER_DATA_LOCK not set), allow writes for testing
        if (process.env.MASTER_DATA_LOCK === 'true') {
          const errorMessage = `MASTER DATA IS LOCKED. Cannot ${action} on ${model}. ` +
            `Set BYPASS_MASTER_DATA_LOCK=true for import scripts.`;
          
          this.logger.error(errorMessage);
          throw new Error(errorMessage);
        }
      }

      return next(params);
    });

    await this.$connect();
  }
}
