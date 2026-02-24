/**
 * TENANT SAFETY IMPLEMENTATION GUIDE
 * ===================================
 * 
 * This document explains how to use the TenantService to ensure 
 * all queries are properly tenant-scoped and prevent cross-tenant data access.
 * 
 * ARCHITECTURE
 * ============
 * 
 * 1. TenantGuard (global guard)
 *    - Extracts candidateId from authenticated user
 *    - Injects it into request.tenantId
 *    - Skips public routes marked with @Public()
 * 
 * 2. TenantService
 *    - Extracts tenantId from request context  
 *    - Provides getTenantFilter() for use in Prisma queries
 *    - Throws error if tenant context not available
 * 
 * 3. Services must inject TenantService and use it for all queries
 * 
 * USAGE PATTERNS
 * ==============
 * 
 * Pattern 1: Using getTenantFilter() in Prisma where clause
 * -----------------------------------------------------------
 * 
 * @Injectable()
 * export class VotersService {
 *   constructor(
 *     private prisma: PrismaService,
 *     @Inject(REQUEST) private request: Request,
 *   ) {}
 * 
 *   async getVoters() {
 *     const tenantService = new TenantService(this.request);
 *     
 *     return this.prisma.voter.findMany({
 *       where: {
 *         ...tenantService.getTenantFilter(),
 *         voted: false,
 *       },
 *     });
 *   }
 * }
 * 
 * Pattern 2: Using @TenantId() parameter decorator
 * --------------------------------------------------
 * 
 * @Injectable()
 * export class ZonesService {
 *   constructor(private prisma: PrismaService) {}
 * 
 *   async getZones(@TenantId() candidateId: string) {
 *     return this.prisma.zone.findMany({
 *       where: { candidateId },
 *     });
 *   }
 * }
 * 
 * VERIFICATION CHECKLIST
 * ======================
 * 
 * For each service that queries candidate-scoped data:
 * 
 * ☑ Import TenantService or use @TenantId() decorator
 * ☑ Always include candidateId in WHERE clauses
 * ☑ Never bypass by using findUnique() without candidateId check
 * ☑ Test that other candidates cannot access this data
 * ☑ Add candidateId to any new indexed queries
 * 
 * CRITICAL RULES
 * ==============
 * 
 * 1. NEVER use findUnique() alone - always verify candidateId
 *    ❌ BAD:  this.prisma.voter.findUnique({ where: { id } })
 *    ✅ GOOD: this.prisma.voter.findUnique({ 
 *                where: { id }, 
 *                where: { candidateId: this.getTenantId() }
 *             })
 * 
 * 2. ALWAYS include candidateId in all findMany/findFirst queries
 *    ✅ GOOD: where: { ...getTenantFilter(), voted: true }
 * 
 * 3. ALWAYS include candidateId in update/delete operations
 *    ✅ GOOD: updateMany({ where: { candidateId, status } })
 * 
 * 4. Test multi-tenant isolation BEFORE production
 *    - Create 2 candidates with test data
 *    - Login as one and verify they cannot access the other's data
 *    - Try accessing IDs directly - should return 403
 * 
 * PUBLIC ROUTES
 * =============
 * 
 * Routes that don't need tenant context should be marked:
 * @Public()
 * @Post('login')
 * login() { }
 * 
 * Examples:
 * - POST /auth/login
 * - POST /auth/refresh
 * - POST /auth/logout
 * - GET /health
 * - POST /access-requests (signup)
 */
