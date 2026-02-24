# =============================================================================
# SECRET MANAGEMENT GUIDE
# Voter Management System
# =============================================================================

## Overview

This document describes the secret management strategy for the VMS platform
in production environments.

## Secret Types

### 1. JWT Secrets (CRITICAL)

| Secret | Purpose | Minimum Length | Rotation |
|--------|---------|----------------|----------|
| JWT_ACCESS_SECRET | Signs access tokens (15 min TTL) | 64 bytes | Annual |
| JWT_REFRESH_SECRET | Signs refresh tokens (7 day TTL) | 64 bytes | Annual |

**Generation:**
```bash
# Generate cryptographically secure secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Requirements:**
- ACCESS and REFRESH secrets MUST be different
- Never reuse secrets across environments
- Store secrets in secure vault, not in code

### 2. MFA Encryption Key

| Secret | Purpose | Length | Rotation |
|--------|---------|--------|----------|
| MFA_SECRET_ENCRYPTION_KEY | Encrypts TOTP secrets at rest | 32 bytes | Annual |

**Generation:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Database Credentials

| Credential | Best Practice |
|------------|---------------|
| POSTGRES_USER | Unique per environment |
| POSTGRES_PASSWORD | 32+ random characters |
| DATABASE_URL | Never commit to git |

---

## Environment File Protection

### .gitignore Configuration
```gitignore
# Environment files
.env
.env.*
!.env.example
!.env.*.example

# Production configs
deploy/.env.production
deploy/secrets/
```

### File Permissions
```bash
# Restrict .env file access
chmod 600 .env.production
chown root:root .env.production
```

---

## Secret Rotation Plan

### Annual Rotation (Recommended)

**Step 1: Generate New Secrets**
```bash
# Generate new JWT secrets
NEW_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
NEW_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

echo "New Access Secret: $NEW_ACCESS_SECRET"
echo "New Refresh Secret: $NEW_REFRESH_SECRET"
```

**Step 2: Plan Rotation Window**
- Schedule during low-traffic period
- Notify users of potential re-login requirement
- Have rollback plan ready

**Step 3: Rotate Secrets**
```bash
# Update .env.production with new secrets
# Restart application
docker-compose -f docker-compose.prod.yml restart api

# All existing sessions will be invalidated
```

**Step 4: Verify**
- Test login functionality
- Verify MFA still works
- Check audit logs for errors

### Emergency Rotation

If a secret is compromised:

1. **Immediately** generate new secrets
2. Update production environment
3. Restart all API instances
4. Force all users to re-login (automatic when tokens invalidated)
5. Investigate breach scope
6. Document incident

---

## Secret Storage Options

### Option 1: Environment Files (Basic)
- Store in `.env.production`
- Encrypt file at rest
- Limit file system access

### Option 2: Docker Secrets (Recommended for Docker)
```yaml
# docker-compose.prod.yml
services:
  api:
    secrets:
      - jwt_access_secret
      - jwt_refresh_secret
      - mfa_encryption_key

secrets:
  jwt_access_secret:
    external: true
  jwt_refresh_secret:
    external: true
  mfa_encryption_key:
    external: true
```

### Option 3: Cloud Secret Managers (Enterprise)

**AWS Secrets Manager:**
```typescript
// Install: npm install @aws-sdk/client-secrets-manager

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

async function getSecret(secretName: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  return response.SecretString;
}

// Usage in config:
// JWT_ACCESS_SECRET = await getSecret('vms/jwt-access-secret');
```

**HashiCorp Vault:**
```bash
# Read secret from Vault
vault kv get -field=value secret/vms/jwt-access-secret
```

---

## Security Checklist

### Pre-Deployment
- [ ] All secrets are unique to this environment
- [ ] No secrets in version control
- [ ] .env.production has restrictive permissions (600)
- [ ] Secrets are minimum required length
- [ ] ACCESS and REFRESH JWT secrets are different

### Post-Deployment
- [ ] Verify secrets are not exposed in logs
- [ ] Verify secrets are not in error responses
- [ ] Test secret rotation process
- [ ] Document secret storage location

### Annual Review
- [ ] Rotate all secrets
- [ ] Review access to secrets
- [ ] Update emergency contacts
- [ ] Test disaster recovery

---

## Never Do This

❌ Commit `.env.production` to git
❌ Log secrets in application logs
❌ Use same secret for access and refresh tokens
❌ Use short or predictable secrets
❌ Share secrets via email or chat
❌ Store secrets in frontend code

## Always Do This

✅ Generate secrets using cryptographic random
✅ Use different secrets per environment
✅ Rotate secrets annually
✅ Limit access to secrets (need-to-know basis)
✅ Monitor for secret exposure
✅ Have a rotation runbook

---

## Emergency Contacts

| Role | Contact | Use Case |
|------|---------|----------|
| Security Lead | [email] | Security breach |
| DevOps Lead | [email] | Infrastructure issues |
| DBA | [email] | Database credentials |

---

*Last Updated: February 2026*
