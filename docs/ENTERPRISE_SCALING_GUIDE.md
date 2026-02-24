# =============================================================================
# ENTERPRISE SCALING GUIDE
# Voter Management System
# =============================================================================

## Overview

This guide covers scaling strategies for VMS to handle enterprise workloads:
- 100k+ voters per candidate
- 500+ concurrent users
- Sub-100ms query response times

---

## 1. Database Scaling

### Connection Pool Optimization

**Current Configuration:**
```env
DATABASE_URL=postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=30
```

**Production Recommendations:**

| Server Size | Pool Size | Rationale |
|-------------|-----------|-----------|
| 2 vCPU | 10-15 | CPU bound limits |
| 4 vCPU | 20-30 | Balanced |
| 8+ vCPU | 40-50 | Memory becomes limit |

**Formula:** `pool_size = (cpu_cores * 2) + effective_spindle_count`

**PgBouncer Configuration (Optional):**
```ini
[databases]
voter_management = host=localhost port=5432 dbname=voter_management

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
```

### Index Optimization

**Existing Indexes:**
```prisma
model Voter {
  @@index([candidateId])
  @@index([candidateId, isDeleted])
  @@index([candidateId, voted])
}
```

**Recommended Partial Indexes (for large datasets):**

```sql
-- Unvoted voters (most common query)
CREATE INDEX CONCURRENTLY idx_voter_unvoted 
ON "Voter" ("candidateId", "createdAt" DESC) 
WHERE "voted" = false AND "isDeleted" = false;

-- Active voters only
CREATE INDEX CONCURRENTLY idx_voter_active 
ON "Voter" ("candidateId", "name") 
WHERE "isDeleted" = false;

-- Search optimization
CREATE INDEX CONCURRENTLY idx_voter_search 
ON "Voter" USING gin (to_tsvector('english', "name" || ' ' || COALESCE("phone", '')))
WHERE "isDeleted" = false;
```

**Index Creation in Production:**
```bash
# Always use CONCURRENTLY to avoid table locks
psql -h localhost -U vms_user -d voter_management -c "
  CREATE INDEX CONCURRENTLY idx_voter_unvoted 
  ON \"Voter\" (\"candidateId\", \"createdAt\" DESC) 
  WHERE \"voted\" = false AND \"isDeleted\" = false;
"
```

### Query Optimization

**Before (Offset Pagination - Slow for Large Datasets):**
```typescript
const voters = await prisma.voter.findMany({
  where: { candidateId, isDeleted: false },
  skip: page * pageSize,  // Slow when page > 100
  take: pageSize,
  orderBy: { createdAt: 'desc' },
});
```

**After (Cursor-Based Pagination - O(1) Performance):**
```typescript
const voters = await prisma.voter.findMany({
  where: { 
    candidateId, 
    isDeleted: false,
    ...(cursor && { createdAt: { lt: cursor } }),
  },
  take: pageSize + 1,  // +1 to check if more pages exist
  orderBy: { createdAt: 'desc' },
});

const hasMore = voters.length > pageSize;
const nextCursor = hasMore ? voters[pageSize - 1].createdAt : null;
return { voters: voters.slice(0, pageSize), nextCursor, hasMore };
```

---

## 2. Application Scaling

### Stateless Architecture

VMS is designed stateless. Session state is stored in:
- **JWT cookies** (client-side)
- **PostgreSQL** (refresh tokens, session data)

This allows horizontal scaling without sticky sessions.

### Docker Swarm / Kubernetes Deployment

**Docker Swarm:**
```yaml
# docker-compose.swarm.yml
version: '3.8'

services:
  api:
    image: vms-api:latest
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
```

**Kubernetes:**
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vms-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vms-api
  template:
    metadata:
      labels:
        app: vms-api
    spec:
      containers:
      - name: api
        image: vms-api:latest
        ports:
        - containerPort: 4000
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        readinessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 15
          periodSeconds: 20
```

### Rate Limiting for Scaled Deployments

With multiple API instances, use Redis for distributed rate limiting:

```typescript
// Install: npm install @nestjs/throttler-storage-redis ioredis

import { ThrottlerStorageRedisService } from '@nestjs/throttler-storage-redis';
import Redis from 'ioredis';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{ ttl: 60000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(
          new Redis({
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT ?? '6379'),
          }),
        ),
      }),
    }),
  ],
})
export class AppModule {}
```

---

## 3. CDN for Static Assets

### Vite Build with CDN

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Asset hashing for cache busting
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'entries/[name]-[hash].js',
      },
    },
  },
});
```

### NGINX CDN Headers

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header X-Content-Type-Options "nosniff";
}
```

### CloudFront Configuration (AWS)

```yaml
# cloudformation/cdn.yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  VMSDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Origins:
          - DomainName: !GetAtt VMSBucket.DomainName
            Id: S3Origin
            S3OriginConfig:
              OriginAccessIdentity: ''
        Enabled: true
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6  # Managed-CachingOptimized
        PriceClass: PriceClass_100
```

---

## 4. Monitoring at Scale

### Application Metrics (Prometheus)

```typescript
// Install: npm install @willsoto/nestjs-prometheus prom-client

import { PrometheusModule, makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: '/metrics',
    }),
  ],
  providers: [
    makeCounterProvider({
      name: 'voter_operations_total',
      help: 'Total voter operations',
      labelNames: ['operation', 'status'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
    }),
  ],
})
export class MetricsModule {}
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "VMS Production",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [{
          "expr": "rate(http_requests_total[5m])"
        }]
      },
      {
        "title": "Response Time P95",
        "type": "graph",
        "targets": [{
          "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
        }]
      },
      {
        "title": "Active Database Connections",
        "type": "singlestat",
        "targets": [{
          "expr": "pg_stat_activity_count"
        }]
      }
    ]
  }
}
```

---

## 5. Read Replicas (High Scale)

For very high read loads, consider PostgreSQL read replicas:

**Architecture:**
```
               ┌──────────────┐
               │   Primary DB  │◄── Writes
               └──────┬───────┘
                      │ Replication
           ┌──────────┼──────────┐
           ▼          ▼          ▼
      ┌─────────┐ ┌─────────┐ ┌─────────┐
      │Replica 1│ │Replica 2│ │Replica 3│
      └─────────┘ └─────────┘ └─────────┘
           ▲          ▲          ▲
           └──────────┼──────────┘
                      │
              ┌───────┴───────┐
              │  API Servers   │◄── Reads
              └───────────────┘
```

**Implementation:**
```typescript
// Use separate clients for read/write
const writeClient = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_PRIMARY } },
});

const readClient = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_REPLICA } },
});

// In service
async findVoters(candidateId: string) {
  return this.readClient.voter.findMany({ where: { candidateId } });
}

async createVoter(data: CreateVoterDto) {
  return this.writeClient.voter.create({ data });
}
```

---

## 6. Scaling Checklist

### Phase 1: Initial Production (1-10k voters)
- [x] Single server deployment
- [x] Connection pooling (20 connections)
- [x] Basic indexes
- [x] Daily backups

### Phase 2: Growth (10k-100k voters)
- [ ] PgBouncer for connection pooling
- [ ] Partial indexes
- [ ] Cursor-based pagination
- [ ] CDN for static assets
- [ ] Prometheus/Grafana monitoring

### Phase 3: Scale (100k+ voters)
- [ ] Multi-instance deployment (3+ API servers)
- [ ] Redis for rate limiting
- [ ] Read replicas
- [ ] Kubernetes/Swarm orchestration
- [ ] Automated scaling policies

### Phase 4: Enterprise (1M+ voters)
- [ ] Sharding by candidateId
- [ ] Event-driven architecture
- [ ] CQRS pattern
- [ ] Global CDN distribution
- [ ] 24/7 monitoring + on-call

---

## Performance Targets

| Metric | Target | Action if Exceeded |
|--------|--------|-------------------|
| API Response P95 | < 200ms | Add indexes, optimize queries |
| API Response P99 | < 500ms | Add caching, read replicas |
| Database CPU | < 70% | Scale vertically or add replicas |
| Memory Usage | < 80% | Add instances, optimize queries |
| Error Rate | < 0.1% | Investigate logs, add retries |

---

*Last Updated: February 2026*
