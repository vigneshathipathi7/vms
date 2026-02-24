#!/bin/bash
# =============================================================================
# Smoke Test Script
# Voter Management System
# =============================================================================
#
# Runs basic health checks after deployment to verify system is working.
#
# Usage:
#   ./smoke-test.sh [base_url]
#
# Example:
#   ./smoke-test.sh https://api.vms.example.com
#

set -euo pipefail

BASE_URL="${1:-http://localhost:4000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASSED=0
FAILED=0

check() {
    local name="$1"
    local expected_status="$2"
    local url="$3"
    local method="${4:-GET}"
    local data="${5:-}"

    echo -n "Testing: $name... "

    if [ -n "$data" ]; then
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$url")
    else
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -X "$method" \
            "$url")
    fi

    if [ "$STATUS" = "$expected_status" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $STATUS)"
        ((PASSED++))
    else
        echo -e "${RED}FAIL${NC} (Expected $expected_status, got $STATUS)"
        ((FAILED++))
    fi
}

echo ""
echo "=============================================="
echo "     VMS SMOKE TEST                           "
echo "=============================================="
echo "Target: $BASE_URL"
echo ""

# Health checks
check "Health endpoint" "200" "$BASE_URL/health"

# Auth endpoints exist
check "Login endpoint exists" "401" "$BASE_URL/auth/login" "POST" '{"email":"","password":""}'

# Protected endpoints require auth
check "Dashboard requires auth" "401" "$BASE_URL/dashboard/summary"
check "Voters requires auth" "401" "$BASE_URL/voters"
check "Audit requires auth" "401" "$BASE_URL/audit/logs"

# Rate limiting (try rapid requests)
echo -n "Testing: Rate limiting... "
for i in {1..15}; do
    RATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test"}' \
        "$BASE_URL/auth/login")
done

if [ "$RATE_STATUS" = "429" ]; then
    echo -e "${GREEN}PASS${NC} (Rate limiting active)"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC} (Rate limiting not triggered)"
    ((FAILED++))
fi

# CORS check
echo -n "Testing: CORS headers... "
CORS_RESPONSE=$(curl -s -I -X OPTIONS \
    -H "Origin: https://evil-site.com" \
    -H "Access-Control-Request-Method: POST" \
    "$BASE_URL/auth/login" 2>/dev/null)

if echo "$CORS_RESPONSE" | grep -q "access-control-allow-origin: https://evil-site.com"; then
    echo -e "${RED}FAIL${NC} (CORS allows any origin!)"
    ((FAILED++))
else
    echo -e "${GREEN}PASS${NC} (CORS restricted)"
    ((PASSED++))
fi

# Security headers
echo -n "Testing: Security headers... "
HEADERS=$(curl -s -I "$BASE_URL/health" 2>/dev/null)

MISSING_HEADERS=""
if ! echo "$HEADERS" | grep -qi "x-content-type-options"; then
    MISSING_HEADERS+=" X-Content-Type-Options"
fi
if ! echo "$HEADERS" | grep -qi "x-frame-options"; then
    MISSING_HEADERS+=" X-Frame-Options"
fi

if [ -z "$MISSING_HEADERS" ]; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}FAIL${NC} (Missing:$MISSING_HEADERS)"
    ((FAILED++))
fi

# Summary
echo ""
echo "=============================================="
echo "     RESULTS                                  "
echo "=============================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}SMOKE TEST FAILED${NC}"
    echo "Review failed checks before proceeding with launch."
    exit 1
else
    echo -e "${GREEN}ALL SMOKE TESTS PASSED${NC}"
    echo "System appears healthy. Proceed with launch."
    exit 0
fi
