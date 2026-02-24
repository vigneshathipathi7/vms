# =============================================================================
# DATABASE MIGRATION GUIDE
# Voter Management System
# =============================================================================

## Overview

This document describes the migration strategy for the VMS platform.
Following these practices ensures safe, reliable schema changes in production.

---

## Migration Principles

### 1. Never Run `prisma migrate dev` in Production

| Environment | Command | Purpose |
|-------------|---------|---------|
| Development | `prisma migrate dev` | Creates and applies migrations |
| Staging | `prisma migrate deploy` | Applies existing migrations |
| Production | `prisma migrate deploy` | Applies existing migrations |

### 2. Migration Workflow

```
Development → Create Migration
    ↓
Code Review → Review changes
    ↓
Staging → Test migration
    ↓
Production → Apply with backup
```

---

## Creating Migrations

### Step 1: Modify Schema

```prisma
// prisma/schema.prisma
model Voter {
  id        String   @id @default(uuid())
  name      String
  phone     String
  // Add new field
  email     String?  @db.VarChar(255)  // NEW
  // ...
}
```

### Step 2: Create Migration

```bash
# In development environment
cd apps/api
npx prisma migrate dev --name add_voter_email

# This creates: prisma/migrations/YYYYMMDDHHMMSS_add_voter_email/migration.sql
```

### Step 3: Review Generated SQL

```sql
-- prisma/migrations/20260223120000_add_voter_email/migration.sql
-- AlterTable
ALTER TABLE "Voter" ADD COLUMN "email" VARCHAR(255);
```

### Step 4: Commit Migration

```bash
git add prisma/migrations/
git commit -m "feat(db): add voter email field"
```

---

## Applying Migrations in Production

### Pre-Migration Checklist

- [ ] Migration tested in staging
- [ ] Database backed up (see backup.sh)
- [ ] Team notified of potential downtime
- [ ] Rollback plan documented

### Step 1: Create Pre-Migration Backup

```bash
# Run backup script
./deploy/scripts/backup.sh

# Verify backup exists
ls -la /backups/vms_backup_*.sql.gz
```

### Step 2: Check Migration Status

```bash
# See pending migrations
npx prisma migrate status
```

### Step 3: Apply Migrations

```bash
# Apply all pending migrations
npx prisma migrate deploy

# Expected output:
# Applying migration `20260223120000_add_voter_email`
# Applied 1 migration successfully
```

### Step 4: Verify

```bash
# Check schema matches Prisma
npx prisma db pull --force
npx prisma validate

# Run quick test
curl http://localhost:4000/health
```

---

## Handling Migration Failures

### Scenario 1: Migration Partially Applied

If a migration fails midway:

```bash
# Check which statements ran
psql -h localhost -U vms_user -d voter_management -c "\dt"

# Option A: Fix and retry
npx prisma migrate resolve --applied "20260223120000_add_voter_email"

# Option B: Rollback from backup
./deploy/scripts/restore.sh latest
```

### Scenario 2: Schema Drift

If production schema doesn't match migrations:

```bash
# Baseline the current state
npx prisma migrate resolve --applied "existing_migration_name"

# Or recreate baseline (DANGER: only for fresh setup)
npx prisma migrate reset --force
```

---

## Safe Migration Patterns

### Adding Nullable Column (Safe)

```prisma
// SAFE: Can be applied without downtime
model User {
  newField String?  // Nullable, no default required
}
```

### Adding Required Column with Default (Safe)

```prisma
// SAFE: Default value provided
model User {
  status String @default("active")
}
```

### Adding Index (Safe but Slow)

```prisma
// SAFE: May lock table briefly on large datasets
model Voter {
  @@index([candidateId, createdAt])
}
```

For large tables, consider:
```sql
-- Create index concurrently (PostgreSQL)
CREATE INDEX CONCURRENTLY idx_voter_candidate_date 
ON "Voter" ("candidateId", "createdAt");
```

### Renaming Column (DANGEROUS)

```prisma
// DANGEROUS: This creates new column and drops old one!
model User {
  // fullName String  // Old name
  displayName String  // New name
}
```

**Safe approach:**
1. Add new column
2. Migrate data: `UPDATE "User" SET "displayName" = "fullName"`
3. Update application to use new column
4. Remove old column in separate migration

### Dropping Column (DANGEROUS)

```prisma
// DANGEROUS: Data will be lost!
model User {
  // Remove field from schema
}
```

**Safe approach:**
1. Stop application from writing to column
2. Create backup
3. Apply migration with explicit approval

---

## Migration Locking

### Preventing Concurrent Migrations

```bash
# Only one migration should run at a time
# Prisma uses advisory locks by default

# If migration hangs, check for locks:
psql -c "SELECT * FROM pg_locks WHERE locktype = 'advisory';"
```

---

## Version Control Best Practices

### Directory Structure

```
prisma/
├── schema.prisma           # Main schema file
├── seed.ts                  # Seed data script
├── seed-locations.ts       # Location data seed
└── migrations/
    ├── migration_lock.toml # Lock file (DO NOT DELETE)
    ├── 20260218060738_init/
    │   └── migration.sql
    ├── 20260219144523_user_profile_fields/
    │   └── migration.sql
    └── 20260220120027_add_locations/
        └── migration.sql
```

### Git Rules

```gitignore
# DO NOT ignore migrations
# prisma/migrations/  ← WRONG!

# Only ignore local development artifacts
*.db
*.db-journal
```

### Migration Naming Convention

```
YYYYMMDDHHMMSS_description
```

Examples:
- `20260223120000_add_voter_email`
- `20260223130000_add_audit_log_index`
- `20260223140000_remove_legacy_field`

---

## Production Migration SOP

### Standard Operating Procedure

```markdown
## Migration: [Description]
Date: YYYY-MM-DD
Migration ID: [ID]
Engineer: [Name]

### Pre-Migration
- [ ] Migration tested in staging
- [ ] Backup completed
- [ ] Team notified in #engineering
- [ ] Rollback plan reviewed

### Execution
- [ ] Verified pending migration: `prisma migrate status`
- [ ] Applied migration: `prisma migrate deploy`
- [ ] Verified success in logs
- [ ] Tested application endpoints

### Post-Migration
- [ ] Monitoring shows no errors
- [ ] Performance metrics stable
- [ ] Announced completion in #engineering

### Rollback (if needed)
1. Stop API: `docker-compose stop api`
2. Restore backup: `./restore.sh latest`
3. Restart API: `docker-compose start api`
4. Investigate root cause
```

---

## Emergency Contacts

| Role | Contact | When to Escalate |
|------|---------|------------------|
| DBA | [email] | Schema corruption, data loss |
| DevOps | [email] | Infrastructure issues |
| Engineering Lead | [email] | Migration blocking release |

---

*Last Updated: February 2026*
