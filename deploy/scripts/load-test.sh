#!/bin/bash
# =============================================================================
# Load Testing Script
# Voter Management System
# =============================================================================
#
# Prerequisites:
#   - wrk (brew install wrk / apt install wrk)
#   - k6 (https://k6.io/docs/get-started/installation/)
#   - curl
#   - jq
#
# Usage:
#   ./load-test.sh [test_name] [options]
#
# Examples:
#   ./load-test.sh all
#   ./load-test.sh voters --duration 60
#   ./load-test.sh login --connections 50
#

set -euo pipefail

# Configuration
BASE_URL="${BASE_URL:-http://localhost:4000}"
DURATION="${DURATION:-30}"
CONNECTIONS="${CONNECTIONS:-100}"
THREADS="${THREADS:-4}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_test() { echo -e "${BLUE}[TEST]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# -----------------------------------------------------------------------------
# Setup: Get auth token
# -----------------------------------------------------------------------------
setup_auth() {
    log_info "Authenticating..."
    
    RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -c /tmp/vms-load-cookies.txt \
        -d '{"email": "admin@test.local", "password": "TestPass123!"}')
    
    if echo "$RESPONSE" | jq -e '.mfaRequired == false' > /dev/null 2>&1; then
        log_info "Authentication successful"
    else
        log_error "Authentication failed"
        echo "$RESPONSE"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# Test 1: Voter List (Read Heavy)
# -----------------------------------------------------------------------------
test_voter_list() {
    log_test "Testing voter list endpoint - ${CONNECTIONS} connections for ${DURATION}s"
    
    if command -v wrk &> /dev/null; then
        wrk -t${THREADS} -c${CONNECTIONS} -d${DURATION}s \
            -H "Cookie: $(cat /tmp/vms-load-cookies.txt | grep vms_access | awk '{print "vms_access=" $7}')" \
            "${BASE_URL}/voters?take=50"
    else
        log_warn "wrk not installed, using curl loop"
        for i in $(seq 1 100); do
            curl -s -o /dev/null -w "%{http_code},%{time_total}\n" \
                -b /tmp/vms-load-cookies.txt \
                "${BASE_URL}/voters?take=50" &
        done
        wait
    fi
}

# -----------------------------------------------------------------------------
# Test 2: Dashboard Summary (Aggregation)
# -----------------------------------------------------------------------------
test_dashboard() {
    log_test "Testing dashboard summary - ${CONNECTIONS} connections for ${DURATION}s"
    
    if command -v wrk &> /dev/null; then
        wrk -t${THREADS} -c${CONNECTIONS} -d${DURATION}s \
            -H "Cookie: $(cat /tmp/vms-load-cookies.txt | grep vms_access | awk '{print "vms_access=" $7}')" \
            "${BASE_URL}/dashboard/summary"
    fi
}

# -----------------------------------------------------------------------------
# Test 3: Concurrent Logins
# -----------------------------------------------------------------------------
test_concurrent_logins() {
    log_test "Testing concurrent logins - 500 login attempts"
    
    TOTAL=0
    SUCCESS=0
    FAILED=0
    RATE_LIMITED=0
    
    for i in $(seq 1 500); do
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "${BASE_URL}/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"email": "admin@test.local", "password": "TestPass123!"}')
        
        ((TOTAL++))
        
        case $STATUS in
            200|201) ((SUCCESS++)) ;;
            429) ((RATE_LIMITED++)) ;;
            *) ((FAILED++)) ;;
        esac
        
        # Brief pause to avoid overwhelming
        if [ $((i % 50)) -eq 0 ]; then
            echo -ne "\r  Progress: $i/500 (Success: $SUCCESS, Rate Limited: $RATE_LIMITED)"
        fi
    done
    
    echo ""
    log_info "Login Test Results:"
    echo "  Total: $TOTAL"
    echo "  Successful: $SUCCESS"
    echo "  Rate Limited: $RATE_LIMITED (expected for security)"
    echo "  Failed: $FAILED"
}

# -----------------------------------------------------------------------------
# Test 4: CSV Export (Memory Stress)
# -----------------------------------------------------------------------------
test_csv_export() {
    log_test "Testing CSV export (memory stress test)"
    
    START=$(date +%s.%N)
    
    curl -s -o /tmp/vms-export-test.csv \
        -b /tmp/vms-load-cookies.txt \
        "${BASE_URL}/voters/export"
    
    END=$(date +%s.%N)
    DURATION=$(echo "$END - $START" | bc)
    SIZE=$(du -h /tmp/vms-export-test.csv | cut -f1)
    LINES=$(wc -l < /tmp/vms-export-test.csv)
    
    log_info "Export Results:"
    echo "  Duration: ${DURATION}s"
    echo "  File Size: $SIZE"
    echo "  Records: $LINES"
    
    rm -f /tmp/vms-export-test.csv
}

# -----------------------------------------------------------------------------
# Test 5: Voter Creation (Write Heavy)
# -----------------------------------------------------------------------------
test_voter_creation() {
    log_test "Testing voter creation - 100 concurrent inserts"
    
    START=$(date +%s.%N)
    
    for i in $(seq 1 100); do
        curl -s -o /dev/null \
            -b /tmp/vms-load-cookies.txt \
            -X POST "${BASE_URL}/voters" \
            -H "Content-Type: application/json" \
            -d "{\"name\": \"Load Test Voter $i\", \"phone\": \"999000$i\", \"zoneId\": \"zone-1\"}" &
    done
    wait
    
    END=$(date +%s.%N)
    DURATION=$(echo "$END - $START" | bc)
    
    log_info "Creation Test: 100 voters in ${DURATION}s"
}

# -----------------------------------------------------------------------------
# Test 6: Database Query Performance
# -----------------------------------------------------------------------------
test_db_queries() {
    log_test "Testing database-heavy operations"
    
    # Audit log fetch
    log_info "  Fetching audit logs..."
    TIME=$(curl -s -o /dev/null -w "%{time_total}" \
        -b /tmp/vms-load-cookies.txt \
        "${BASE_URL}/audit/logs?take=100")
    echo "  Audit logs (100 records): ${TIME}s"
    
    # Dashboard aggregation
    log_info "  Running dashboard aggregation..."
    TIME=$(curl -s -o /dev/null -w "%{time_total}" \
        -b /tmp/vms-load-cookies.txt \
        "${BASE_URL}/dashboard/summary")
    echo "  Dashboard summary: ${TIME}s"
    
    # Voter search
    log_info "  Running voter search..."
    TIME=$(curl -s -o /dev/null -w "%{time_total}" \
        -b /tmp/vms-load-cookies.txt \
        "${BASE_URL}/voters?search=test&take=50")
    echo "  Voter search: ${TIME}s"
}

# -----------------------------------------------------------------------------
# Run k6 Test (if available)
# -----------------------------------------------------------------------------
run_k6_test() {
    if ! command -v k6 &> /dev/null; then
        log_warn "k6 not installed, skipping advanced load test"
        return
    fi
    
    log_test "Running k6 load test..."
    
    cat > /tmp/vms-k6-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const errorRate = new Rate('errors');
const voterListTrend = new Trend('voter_list_duration');

export const options = {
    stages: [
        { duration: '30s', target: 50 },   // Ramp up
        { duration: '1m', target: 100 },   // Steady load
        { duration: '30s', target: 200 },  // Spike
        { duration: '30s', target: 50 },   // Recovery
        { duration: '10s', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],  // 95% under 500ms
        errors: ['rate<0.01'],             // Error rate < 1%
    },
};

export function setup() {
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
        email: 'admin@test.local',
        password: 'TestPass123!',
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    return { cookies: loginRes.cookies };
}

export default function(data) {
    const params = {
        cookies: { vms_access: data.cookies.vms_access[0].value },
    };
    
    // Test voter list
    const start = Date.now();
    const res = http.get(`${BASE_URL}/voters?take=50`, params);
    voterListTrend.add(Date.now() - start);
    
    check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    }) || errorRate.add(1);
    
    sleep(1);
}
EOF

    k6 run -e BASE_URL="${BASE_URL}" /tmp/vms-k6-test.js
    rm /tmp/vms-k6-test.js
}

# -----------------------------------------------------------------------------
# Print Results Summary
# -----------------------------------------------------------------------------
print_summary() {
    echo ""
    echo "=============================================="
    echo "          LOAD TEST SUMMARY                   "
    echo "=============================================="
    echo ""
    echo "Target: ${BASE_URL}"
    echo "Connections: ${CONNECTIONS}"
    echo "Duration: ${DURATION}s"
    echo ""
    echo "Performance Targets:"
    echo "  - API response time: < 500ms (95th percentile)"
    echo "  - Error rate: < 1%"
    echo "  - Concurrent users: 500+"
    echo ""
    echo "If any test failed targets, investigate:"
    echo "  1. Database indexes"
    echo "  2. Connection pool settings"
    echo "  3. Query optimization"
    echo "  4. Hardware resources"
    echo ""
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    local test_name="${1:-all}"
    
    echo ""
    echo "=============================================="
    echo "     VMS LOAD TESTING - ${test_name^^}        "
    echo "=============================================="
    echo ""
    
    setup_auth
    
    case $test_name in
        all)
            test_voter_list
            test_dashboard
            test_concurrent_logins
            test_csv_export
            test_voter_creation
            test_db_queries
            run_k6_test
            ;;
        voters)
            test_voter_list
            ;;
        dashboard)
            test_dashboard
            ;;
        login)
            test_concurrent_logins
            ;;
        export)
            test_csv_export
            ;;
        create)
            test_voter_creation
            ;;
        queries)
            test_db_queries
            ;;
        k6)
            run_k6_test
            ;;
        *)
            log_error "Unknown test: $test_name"
            echo "Available tests: all, voters, dashboard, login, export, create, queries, k6"
            exit 1
            ;;
    esac
    
    print_summary
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --duration)
            DURATION="$2"
            shift 2
            ;;
        --connections)
            CONNECTIONS="$2"
            shift 2
            ;;
        --url)
            BASE_URL="$2"
            shift 2
            ;;
        *)
            TEST_NAME="$1"
            shift
            ;;
    esac
done

main "${TEST_NAME:-all}"
