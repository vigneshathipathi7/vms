# Master Data Policy

## Overview

This document defines the policy for managing **Master Geographic Data** in the Voter Management System (VMS). Master data is **immutable** and **read-only** in production environments.

## Master Data Models

The following models are classified as Master Data:

| Model | Description | Expected Count (TN) |
|-------|-------------|---------------------|
| `District` | Administrative districts | 38 |
| `Taluk` | Sub-district administrative units | 371+ |
| `Village` | Village/Panchayat level | 12,500+ |
| `Ward` | Polling ward/booth level | Variable |
| `AssemblyConstituency` | State legislative assembly constituencies | 234 |
| `ParliamentaryConstituency` | Lok Sabha constituencies | 39 |
| `PollingBooth` | Polling station locations | Variable |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MASTER LAYER (READ-ONLY)                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────────────────┐  │
│  │District │  │ Taluk   │  │ Assembly/Parliament Const.  │  │
│  └─────────┘  └─────────┘  └─────────────────────────────┘  │
│  ┌─────────┐  ┌─────────┐  ┌─────────────┐                  │
│  │ Village │  │  Ward   │  │PollingBooth │                  │
│  └─────────┘  └─────────┘  └─────────────┘                  │
│                                                              │
│  ⚠️  No API/UI modifications allowed                        │
│  ✅  Import scripts only (with BYPASS_MASTER_DATA_LOCK=true) │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   TENANT LAYER (EDITABLE)                    │
│  ┌───────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐  │
│  │ Candidate │  │   User   │  │   Voter    │  │   Zone   │  │
│  └───────────┘  └──────────┘  └────────────┘  └──────────┘  │
│  ┌───────────┐  ┌──────────┐  ┌────────────┐                │
│  │ SubUser   │  │ AuditLog │  │AccessRequest│                │
│  └───────────┘  └──────────┘  └────────────┘                │
│                                                              │
│  ✅  Full CRUD via API                                       │
│  ✅  Tenant-scoped (candidateId isolation)                   │
└─────────────────────────────────────────────────────────────┘
```

## Protection Mechanisms

### 1. API Layer Protection

The `LocationsController` only exposes **GET** endpoints:

```typescript
GET /locations/districts       // List all districts
GET /locations/taluks          // List all taluks  
GET /locations/assemblies      // List assembly constituencies
GET /locations/parliamentary   // List parliamentary constituencies
GET /locations/stats           // Get location statistics
```

**No POST, PATCH, PUT, or DELETE endpoints exist.**

### 2. Prisma Middleware Protection

The `PrismaService` includes middleware that blocks write operations:

```typescript
const MASTER_DATA_MODELS = [
  'District', 'Taluk', 'Village', 'Ward',
  'AssemblyConstituency', 'ParliamentaryConstituency', 'PollingBooth'
];

// Write operations are blocked unless BYPASS_MASTER_DATA_LOCK=true
```

### 3. UI Protection

The `LocationsSettingsPage` is a **read-only viewer** that:
- Displays location statistics
- Shows data source information
- Contains no edit/create/delete controls

## Data Import Process

### Prerequisites

1. **Database backup** - Always backup before import
2. **Script validation** - Review import script changes
3. **Staging test** - Run on staging first

### Import Script

Location: `apps/api/scripts/import-tn-constituencies.ts`

```bash
# Run with bypass flag
cd apps/api
BYPASS_MASTER_DATA_LOCK=true npx ts-node --transpile-only scripts/import-tn-constituencies.ts
```

### Verification Script

Location: `apps/api/scripts/verify-locations.ts`

```bash
cd apps/api
npx ts-node --transpile-only scripts/verify-locations.ts
```

## Data Sources

All master data is sourced from official government sources:

1. **Election Commission of India (ECI)**
   - Parliamentary constituency definitions
   - Assembly constituency definitions
   - Official EC codes

2. **Tamil Nadu State Election Commission**
   - Local body boundaries
   - Polling booth allocations

3. **Government of Tamil Nadu**
   - District and taluk administrative boundaries
   - Revenue village data

## Change Management

### When to Update Master Data

- New district formation (rare)
- Constituency delimitation (every 10+ years)
- Administrative boundary changes
- Polling booth reallocation (before elections)

### Update Procedure

1. **Request** - Document the change requirement
2. **Source** - Obtain official government notification
3. **Script** - Create migration/import script
4. **Review** - Code review by senior developer
5. **Backup** - Full database backup
6. **Stage** - Deploy to staging environment
7. **Test** - Run verification scripts
8. **Deploy** - Deploy to production
9. **Verify** - Confirm counts match expected

### Rollback Procedure

```bash
# Restore from backup if import fails
pg_restore -h localhost -U postgres -d voter_management backup_file.sql
```

## Why Master Data is Immutable

If geographic data changes unexpectedly:

| Impact | Consequence |
|--------|-------------|
| Voter assignments | Voters may be linked to non-existent wards |
| Sub-user permissions | Ward-based access controls break |
| Analytics | Historical reports become inconsistent |
| Audit trails | Audit logs reference invalid locations |
| Zone definitions | Custom zones lose their geographic context |

**Data integrity must be maintained at all costs.**

## Compliance

This policy ensures:

- ✅ Election Commission data accuracy requirements
- ✅ Geographic data integrity
- ✅ Audit trail consistency
- ✅ Multi-tenant data isolation
- ✅ Administrative boundary accuracy

## Contact

For master data corrections or updates, contact:

- **System Administrator** - For import script execution
- **Technical Lead** - For data source verification
- **Product Owner** - For change authorization

---

**Last Updated:** February 2026  
**Policy Version:** 1.0
