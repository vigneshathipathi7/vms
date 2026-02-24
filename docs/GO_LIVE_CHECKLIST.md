# =============================================================================
# PRODUCTION GO-LIVE CHECKLIST
# Voter Management System
# =============================================================================

## Pre-Launch Verification (Complete ALL Items)

### 1️⃣ Security
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] SSL certificate valid and not expiring soon
- [ ] Cookies configured: `HttpOnly`, `Secure`, `SameSite=Strict`
- [ ] JWT secrets are ≥64 bytes and unique per environment
- [ ] Access and Refresh JWT secrets are DIFFERENT
- [ ] MFA encryption key is configured
- [ ] CORS restricted to production domain only
- [ ] Rate limiting active on auth endpoints
- [ ] Stack traces disabled in error responses
- [ ] Swagger/API docs disabled in production
- [ ] `.env` files not in git
- [ ] Debug endpoints disabled
- [ ] Helmet security headers active

### 2️⃣ Multi-Tenant Isolation
- [ ] TenantGuard is globally applied
- [ ] Penetration test: Cross-tenant access attempt → 403/404
- [ ] Penetration test: JWT tampering → 401
- [ ] Penetration test: Refresh token replay → All sessions revoked
- [ ] Penetration test: Sub-user cannot access other wards
- [ ] CSV export returns only current tenant's data
- [ ] Audit logs filtered by candidateId

### 3️⃣ Database
- [ ] Production database is separate from dev/staging
- [ ] Connection pooling configured (20+ connections)
- [ ] All indexes created successfully
- [ ] Migration applied: `prisma migrate deploy`
- [ ] Location data imported
- [ ] Database user has minimum required permissions
- [ ] SSL enabled for database connection

### 4️⃣ Backup & Recovery
- [ ] Daily backup script installed and running
- [ ] Backup verified: Can successfully restore
- [ ] Offsite backup configured (S3/GCS)
- [ ] Backup retention policy: 30 days minimum
- [ ] Restore procedure documented and tested

### 5️⃣ Monitoring
- [ ] Sentry DSN configured
- [ ] Error alerts going to correct channel
- [ ] Server monitoring active (CPU, Memory, Disk)
- [ ] Database slow query logging enabled
- [ ] Log rotation configured
- [ ] Health check endpoint working

### 6️⃣ Performance
- [ ] Load test passed: 500 concurrent users
- [ ] API P95 response time < 500ms
- [ ] CSV export of 10k records completes successfully
- [ ] Dashboard loads in < 2 seconds
- [ ] No N+1 query issues

### 7️⃣ Legal & Compliance
- [ ] Privacy Policy page accessible
- [ ] Terms of Service page accessible
- [ ] Legal disclaimer about non-official data visible
- [ ] Data retention policy documented
- [ ] Cookie consent (if required by jurisdiction)

### 8️⃣ Infrastructure
- [ ] NGINX configured with security headers
- [ ] Request body size limit configured
- [ ] Timeout limits configured
- [ ] Gzip compression enabled
- [ ] CDN configured for static assets (optional)
- [ ] DNS properly configured
- [ ] Firewall rules: Only 80/443 exposed

### 9️⃣ Operational Readiness
- [ ] Deployment procedure documented
- [ ] Rollback procedure documented
- [ ] On-call rotation established
- [ ] Escalation contacts listed
- [ ] Runbook available for common issues
- [ ] Team trained on new features

### 🔟 Final Verification
- [ ] Fresh user can register and login
- [ ] Password reset works (if implemented)
- [ ] MFA enrollment works
- [ ] Voter CRUD operations work
- [ ] Session timeout works (15 minutes)
- [ ] Logout clears all cookies
- [ ] Sub-user creation works
- [ ] Zone management works
- [ ] CSV export works

---

## Launch Command Sequence

```bash
# 1. Final backup of staging (safety)
./deploy/scripts/backup.sh

# 2. Pull latest code
git pull origin main

# 3. Install dependencies
cd apps/api && npm ci --production

# 4. Build
npm run build

# 5. Run migrations
npx prisma migrate deploy

# 6. Generate Prisma client
npx prisma generate

# 7. Start server (or restart via systemd/docker)
npm start
# OR
docker-compose -f deploy/docker/docker-compose.prod.yml up -d

# 8. Verify health
curl https://api.yoursite.com/health

# 9. Run smoke tests
./deploy/scripts/smoke-test.sh
```

---

## Post-Launch Monitoring

### First Hour
- [ ] Monitor error rates in Sentry
- [ ] Check API response times
- [ ] Verify user registrations working
- [ ] Watch database connections

### First Day
- [ ] Review all error reports
- [ ] Check backup ran successfully
- [ ] Monitor resource usage trends
- [ ] Collect user feedback

### First Week
- [ ] Weekly security scan
- [ ] Review audit logs for anomalies
- [ ] Performance trending analysis
- [ ] Address any reported issues

---

## Emergency Rollback

If critical issues are discovered:

```bash
# 1. Stop current deployment
docker-compose -f docker-compose.prod.yml down

# 2. Restore database from backup
./deploy/scripts/restore.sh latest

# 3. Deploy previous version
git checkout <previous-tag>
npm run build
npm start

# 4. Communicate to users
# Send notification about temporary service degradation
```

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineering Lead | | | |
| Security Lead | | | |
| Operations | | | |
| Product Owner | | | |

---

**Launch Approved:** ☐ YES ☐ NO

**Scheduled Launch Date:** ________________

**Scheduled Launch Time:** ________________ (UTC)

---

*Last Updated: February 2026*
