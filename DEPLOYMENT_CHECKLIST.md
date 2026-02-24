# QUICK REFERENCE - PRODUCTION DEPLOYMENT GUIDE

## 🎯 Pre-Deployment Checklist (15 minutes)

### Database
- [ ] Run migration: `npx prisma migrate deploy`
- [ ] Verify LocationDatasetVersion table exists
- [ ] Import locations: `npx ts-node apps/api/scripts/import-locations.ts`
- [ ] Test: `SELECT COUNT(*) FROM "LocationDatasetVersion";` (should be 1)

### Dependencies
- [ ] Install: `npm install @nestjs/schedule`
- [ ] Verify package.json has @nestjs/schedule ^4.1.1

### Environment Variables
- [ ] DATABASE_URL has correct connection string
- [ ] JWT_SECRET configured
- [ ] NODE_ENV=production
- [ ] CAPTION_API_KEY set (if using captcha)

### Background Jobs
- [ ] ScheduleModule imported in AppModule
- [ ] JobsModule imported in AppModule
- [ ] Logs show "Starting database optimization" pattern in logs
- [ ] No errors in `npm run build` output

---

## 🔒 Security Verification (10 minutes)

### Tenant Guard
- [ ] TenantGuard is globally applied as APP_GUARD
- [ ] @Public() decorator on login, register, refresh routes
- [ ] Cannot access /dashboard without authentication

### Frontend Session Timeout
- [ ] useSessionTimeout hook integrated in App.tsx
- [ ] Test: Idle 15 minutes → auto-logout occurs
- [ ] Test: Click mouse 14:59 minutes → still logged in

### Token Reuse Detection
- [ ] Test: Refresh token twice → second use returns 401
- [ ] Test: After logout, old refresh token → 401
- [ ] Check audit log shows REFRESH_TOKEN_REUSE_DETECTED

---

## 📊 Performance Validation (5 minutes)

Run these queries in your database:

```sql
-- Verify indexes exist
SELECT * FROM pg_indexes WHERE tablename = 'Voter';
-- Should show: (candidateId), (candidateId, isDeleted), (candidateId, voted)

-- Test voter query performance
EXPLAIN ANALYZE SELECT * FROM "Voter" 
WHERE "candidateId" = 'candidate-123' 
AND "isDeleted" = false 
LIMIT 50;
-- Should show: Index Scan (not Seq Scan)

-- Count records
SELECT COUNT(*) FROM "Voter";
SELECT COUNT(*) FROM "AuditLog";
SELECT COUNT(*) FROM "RefreshToken";
```

---

## 🧪 Multi-Tenant Isolation Test (20 minutes)

**Create two candidates in database**:
```sql
INSERT INTO "Candidate" (id, fullName, email, phone, "electionType")
VALUES 
  ('cand-a', 'Candidate A', 'a@test.com', '9999999999', 'LOCAL_BODY'),
  ('cand-b', 'Candidate B', 'b@test.com', '8888888888', 'LOCAL_BODY');
```

**Test CSV Export Isolation**:
```bash
# As Candidate A
curl -H "Cookie: vms_access=token_a" \
  http://localhost:3000/api/audit/export \
  -o audit_a.csv

# As Candidate B
curl -H "Cookie: vms_access=token_b" \
  http://localhost:3000/api/audit/export \
  -o audit_b.csv

# Verify files contain only each candidate's data
wc -l audit_a.csv audit_b.csv  # Should be different counts
```

**Test Direct ID Access Block**:
```bash
# Get a voter ID from Candidate A
VOTER_ID_FROM_A='voter-123-a'

# Try to access as Candidate B
curl -H "Cookie: vms_access=token_b" \
  http://localhost:3000/api/voters/$VOTER_ID_FROM_A

# Expected: 404 or 403 (NOT 200 with data)
```

---

## 🚀 Deployment Commands

```bash
# Test build
npm run build
echo $?  # Should be 0

# Start server
npm start
# Watch for: "Starting database optimization!" in logs

# Verify health check
curl http://localhost:3000/health
# Should return: { "status": "ok", "service": "voter-management-api" }

# Verify migrations ran
npx prisma migrate status
# Should show: "All migrations have been applied"
```

---

## 📍 Key File Locations

**New Security Features**:
- Tenant Guard: `src/modules/auth/guards/tenant.guard.ts`
- Session Timeout Hook: `src/hooks/useSessionTimeout.ts` (frontend)
- Refresh Token Detection: `src/modules/auth/auth.service.ts` (line ~123)
- Background Jobs: `src/modules/jobs/jobs.service.ts`

**Documentation**:
- Tenant Safety: `apps/api/TENANT_SAFETY_GUIDE.md`
- DB Scaling: `apps/api/DATABASE_SCALING.md`
- Isolation Tests: `MULTI_CANDIDATE_ISOLATION_TEST_PLAN.md`
- This Guide: `IMPLEMENTATION_COMPLETE.md`

---

## ⚠️ Common Issues & Fixes

**Issue**: "Cannot find module '@nestjs/schedule'"
```bash
Fix: npm install @nestjs/schedule
```

**Issue**: "LocationDatasetVersion table does not exist"
```bash
Fix: npx prisma migrate deploy
```

**Issue**: "Bearer token not valid" after login
```bash
Fix: Verify JWT_SECRET matches in .env and code
```

**Issue**: "Cannot read property 'tenantId' of undefined"
```bash
Fix: Ensure @Public() decorator on login route
```

**Issue**: Background jobs not running
```bash
Fix: Verify @Cron decorators use UTC times
Fix: Check NODE_ENV is NOT test
```

---

## 📞 Monitoring Commands

```bash
# Check background job logs
tail -f logs/application.log | grep -i "clean\|optimize\|archive"

# Monitor slow queries
SELECT * FROM pg_stat_statements 
WHERE mean_exec_time > 100 
ORDER BY mean_exec_time DESC;

# Check connection count
SELECT count(*) FROM pg_stat_activity;
# Should be < 20 (per PgBouncer config)

# Audit log growth
SELECT COUNT(*) FROM "AuditLog" 
WHERE "createdAt" > NOW() - INTERVAL '1 day';
# Expected: ~1000-5000 events per day

# Orphaned sessions (should be 0)
SELECT COUNT(*) FROM "RefreshToken" 
WHERE "revokedAt" IS NULL 
AND "expiresAt" < NOW();
```

---

## ✅ Post-Deployment Verification

After deploying:
- [ ] Users can login
- [ ] Session timeout works (wait 15 min, try to access dashboard)
- [ ] CSV export works (visit /audit/export)
- [ ] Multi-candidate isolation test passes
- [ ] No CRITICAL audit events logged
- [ ] Database backups configured
- [ ] Monitoring alerts set up
- [ ] On-call runbook available
- [ ] Team trained on new features

---

**Status**: Ready for Production ✅  
**Last Updated**: February 23, 2026  
**Deployment Estimated Time**: 30 minutes  
**Rollback Time**: 5 minutes (simple version revert)
