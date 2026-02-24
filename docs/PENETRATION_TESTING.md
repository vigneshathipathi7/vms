# =============================================================================
# PENETRATION TESTING GUIDE
# Voter Management System
# =============================================================================

## Overview

This document provides a comprehensive penetration testing checklist for the
VMS platform. Execute these tests before production deployment and after any
major security-related changes.

**Target:** Multi-tenant election management SaaS  
**Critical Assets:** Voter data, authentication system, tenant isolation  
**Test Environment:** Staging only (never test on production with real data)

---

## Pre-Testing Setup

### 1. Create Test Accounts

```sql
-- Create two test candidates (tenants)
INSERT INTO "Candidate" (id, "fullName", email, phone, "electionType", "createdAt", "updatedAt")
VALUES 
  ('test-cand-a', 'Candidate Alpha', 'alpha@test.local', '9999999991', 'LOCAL_BODY', NOW(), NOW()),
  ('test-cand-b', 'Candidate Beta', 'beta@test.local', '9999999992', 'LOCAL_BODY', NOW(), NOW());
```

### 2. Create Test Users

```bash
# Register admin users for each candidate via API
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "admin-a@test.local", "password": "TestPass123!", "fullName": "Admin A", "phone": "9999999993", "candidateId": "test-cand-a"}'

curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "admin-b@test.local", "password": "TestPass123!", "fullName": "Admin B", "phone": "9999999994", "candidateId": "test-cand-b"}'
```

### 3. Get Auth Tokens

```bash
# Login as Candidate A admin
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies-a.txt \
  -d '{"email": "admin-a@test.local", "password": "TestPass123!"}'

# Login as Candidate B admin
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies-b.txt \
  -d '{"email": "admin-b@test.local", "password": "TestPass123!"}'
```

---

## Test 1: JWT Tampering

### Objective
Verify that modified JWTs are rejected.

### Steps

1. **Extract JWT from cookies:**
```bash
# Get the access token
ACCESS_TOKEN=$(cat cookies-a.txt | grep vms_access | awk '{print $7}')
echo $ACCESS_TOKEN
```

2. **Decode and modify JWT:**
```bash
# Decode JWT (base64)
echo $ACCESS_TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .

# Note the candidateId, then try to forge a new token with different candidateId
# (This requires knowing the secret, which attacker doesn't have)
```

3. **Test modified token:**
```bash
# Create a malformed token by changing characters
MODIFIED_TOKEN="${ACCESS_TOKEN:0:-5}XXXXX"

# Try to use it
curl -X GET http://localhost:4000/dashboard/summary \
  -H "Cookie: vms_access=$MODIFIED_TOKEN"
```

### Expected Result
- ❌ Request rejected with 401 Unauthorized
- ❌ No data returned

### Pass Criteria
- [ ] Modified tokens rejected
- [ ] Invalid signatures rejected
- [ ] Expired tokens rejected

---

## Test 2: Cross-Tenant Data Access

### Objective
Verify complete data isolation between tenants.

### Steps

1. **Create voter for Candidate A:**
```bash
VOTER_ID_A=$(curl -X POST http://localhost:4000/voters \
  -b cookies-a.txt \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Voter A", "phone": "8888888881", "zoneId": "zone-a-1"}' \
  | jq -r '.id')

echo "Voter A ID: $VOTER_ID_A"
```

2. **Attempt access from Candidate B:**
```bash
# Try direct ID access
curl -X GET "http://localhost:4000/voters/$VOTER_ID_A" \
  -b cookies-b.txt \
  -w "\nHTTP Status: %{http_code}\n"

# Try update
curl -X PATCH "http://localhost:4000/voters/$VOTER_ID_A" \
  -b cookies-b.txt \
  -H "Content-Type: application/json" \
  -d '{"name": "Hacked Voter"}' \
  -w "\nHTTP Status: %{http_code}\n"

# Try delete
curl -X DELETE "http://localhost:4000/voters/$VOTER_ID_A" \
  -b cookies-b.txt \
  -w "\nHTTP Status: %{http_code}\n"
```

3. **Check list endpoint:**
```bash
# Candidate B should NOT see Candidate A's voters
curl -X GET "http://localhost:4000/voters?take=100" \
  -b cookies-b.txt | jq '.items[].name' | grep -c "Test Voter A"
```

### Expected Result
- ❌ Direct access returns 403 or 404
- ❌ Update/Delete rejected
- ❌ List does not include other tenant's data

### Pass Criteria
- [ ] Cannot read other tenant's voters
- [ ] Cannot modify other tenant's voters
- [ ] Cannot delete other tenant's voters
- [ ] List endpoints filter by tenant

---

## Test 3: Refresh Token Replay

### Objective
Verify that reused refresh tokens trigger security response.

### Steps

1. **Login and capture refresh token:**
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies-replay.txt \
  -d '{"email": "admin-a@test.local", "password": "TestPass123!"}'

REFRESH_TOKEN=$(cat cookies-replay.txt | grep vms_refresh | awk '{print $7}')
```

2. **Use refresh token (first time - should work):**
```bash
curl -X POST http://localhost:4000/auth/refresh \
  -b cookies-replay.txt \
  -c cookies-replay-new.txt \
  -w "\nHTTP Status: %{http_code}\n"
```

3. **Replay the original refresh token:**
```bash
# Use the OLD refresh token again
curl -X POST http://localhost:4000/auth/refresh \
  -H "Cookie: vms_refresh=$REFRESH_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
```

4. **Verify session revocation:**
```bash
# Check if ALL sessions were revoked
curl -X GET http://localhost:4000/auth/me \
  -b cookies-replay-new.txt \
  -w "\nHTTP Status: %{http_code}\n"
```

### Expected Result
- ✅ First refresh succeeds
- ❌ Replayed token rejected (401)
- ❌ ALL user sessions revoked (security measure)

### Pass Criteria
- [ ] Refresh token replay detected
- [ ] All sessions invalidated
- [ ] REFRESH_TOKEN_REUSE_DETECTED logged in audit

---

## Test 4: Export Authorization

### Objective
Verify export endpoints restricted to admins.

### Steps

1. **Create sub-user (non-admin):**
```bash
# Create sub-user via admin
SUB_USER_ID=$(curl -X POST http://localhost:4000/users/sub-users \
  -b cookies-a.txt \
  -H "Content-Type: application/json" \
  -d '{"username": "subuser-test", "password": "SubPass123!", "fullName": "Sub User", "phone": "7777777771", "assignedWardIds": ["ward-1"]}' \
  | jq -r '.id')

# Login as sub-user
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies-sub.txt \
  -d '{"email": "subuser-test", "password": "SubPass123!"}'
```

2. **Attempt exports as sub-user:**
```bash
# Try audit export
curl -X GET http://localhost:4000/audit/export \
  -b cookies-sub.txt \
  -w "\nHTTP Status: %{http_code}\n"

# Try voter export
curl -X GET http://localhost:4000/voters/export \
  -b cookies-sub.txt \
  -w "\nHTTP Status: %{http_code}\n"
```

### Expected Result
- ❌ Sub-user cannot export (403 Forbidden)
- ✅ Admin can export

### Pass Criteria
- [ ] Export requires admin role
- [ ] Non-admin receives 403
- [ ] Attempt logged in audit

---

## Test 5: Brute Force Login Protection

### Objective
Verify rate limiting on login endpoint.

### Steps

1. **Rapid login attempts:**
```bash
# Script to test rate limiting
for i in {1..20}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:4000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "admin-a@test.local", "password": "wrongpass"}')
  echo "Attempt $i: HTTP $STATUS"
  sleep 0.1
done
```

2. **Check for rate limit response:**
```bash
# After being rate limited, any request should return 429
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin-a@test.local", "password": "TestPass123!"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

### Expected Result
- ✅ First 5 attempts processed
- ❌ Subsequent attempts return 429 Too Many Requests
- Rate limit resets after window

### Pass Criteria
- [ ] Rate limiting active on /auth/login
- [ ] 429 response after threshold
- [ ] Valid login works after rate limit window

---

## Test 6: SQL Injection

### Objective
Verify protection against SQL injection attacks.

### Steps

1. **Test search parameters:**
```bash
# Attempt SQL injection in search
curl -X GET "http://localhost:4000/voters?search=%27%20OR%201%3D1%20--" \
  -b cookies-a.txt

curl -X GET "http://localhost:4000/voters?search='; DROP TABLE voters; --" \
  -b cookies-a.txt
```

2. **Test ID parameters:**
```bash
curl -X GET "http://localhost:4000/voters/1' OR '1'='1" \
  -b cookies-a.txt \
  -w "\nHTTP Status: %{http_code}\n"
```

3. **Test body parameters:**
```bash
curl -X POST http://localhost:4000/voters \
  -b cookies-a.txt \
  -H "Content-Type: application/json" \
  -d '{"name": "Test'\''--", "phone": "1234567890"}'
```

### Expected Result
- ❌ No SQL errors exposed
- ❌ No unintended data returned
- Prisma parameterized queries prevent injection

### Pass Criteria
- [ ] No SQL error messages
- [ ] Injection strings treated as literals
- [ ] Database integrity maintained

---

## Test 7: Session Timeout

### Objective
Verify automatic session expiration.

### Steps

1. **Login and wait:**
```bash
# Login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies-timeout.txt \
  -d '{"email": "admin-a@test.local", "password": "TestPass123!"}'

# Verify working
curl -X GET http://localhost:4000/auth/me \
  -b cookies-timeout.txt \
  -w "\nHTTP Status: %{http_code}\n"

# Wait for access token expiry (15 minutes in production)
# In test, use shorter TTL or wait
sleep 900  # 15 minutes

# Try access without refresh
curl -X GET http://localhost:4000/auth/me \
  -b cookies-timeout.txt \
  -w "\nHTTP Status: %{http_code}\n"
```

### Expected Result
- ❌ After 15 minutes, access token invalid
- Refresh required or re-login needed

### Pass Criteria
- [ ] Access token expires after TTL
- [ ] 401 returned for expired token
- [ ] Refresh flow works correctly

---

## Test 8: CORS Bypass Attempt

### Objective
Verify CORS restrictions enforced.

### Steps

1. **Cross-origin request:**
```bash
# Simulate request from unauthorized origin
curl -X POST http://localhost:4000/auth/login \
  -H "Origin: https://evil-site.com" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin-a@test.local", "password": "TestPass123!"}' \
  -i
```

2. **Check CORS headers:**
```bash
curl -X OPTIONS http://localhost:4000/auth/login \
  -H "Origin: https://evil-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -i
```

### Expected Result
- ❌ No Access-Control-Allow-Origin for unauthorized origins
- ✅ Only FRONTEND_ORIGIN allowed

### Pass Criteria
- [ ] CORS blocks unauthorized origins
- [ ] Credentials not sent cross-origin
- [ ] Preflight requests handled correctly

---

## Results Documentation Template

```markdown
## Penetration Test Results

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** [Staging/QA]
**Application Version:** [Git commit hash]

### Summary

| Test | Status | Notes |
|------|--------|-------|
| JWT Tampering | ✅ PASS | |
| Cross-Tenant Access | ✅ PASS | |
| Refresh Token Replay | ✅ PASS | |
| Export Authorization | ✅ PASS | |
| Brute Force Protection | ✅ PASS | |
| SQL Injection | ✅ PASS | |
| Session Timeout | ✅ PASS | |
| CORS Bypass | ✅ PASS | |

### Issues Found

[List any issues with severity]

### Recommendations

[List recommendations]

### Sign-off

- [ ] Security Lead: ___________  Date: ___________
- [ ] Dev Lead: ___________  Date: ___________
```

---

## Post-Testing Cleanup

```sql
-- Remove test data
DELETE FROM "User" WHERE email LIKE '%@test.local';
DELETE FROM "Candidate" WHERE id LIKE 'test-cand-%';
```

---

*Last Updated: February 2026*
