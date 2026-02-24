#!/bin/bash
# =============================================================================
# Database Backup Script
# Voter Management System - Production
# =============================================================================
#
# This script performs automated PostgreSQL backups with:
# - Daily full backups
# - 30-day retention policy
# - Compression (gzip)
# - Integrity verification
# - Optional offsite upload (S3/GCS)
#
# Add to crontab:
#   0 0 * * * /path/to/backup.sh >> /var/log/vms-backup.log 2>&1
#

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="vms_backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Database credentials (from environment)
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${POSTGRES_USER:-vms_user}"
PGPASSWORD="${POSTGRES_PASSWORD}"
PGDATABASE="${POSTGRES_DB:-voter_management}"

export PGPASSWORD

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create backup directory if not exists
mkdir -p "${BACKUP_DIR}"

log_info "Starting database backup..."
log_info "Database: ${PGDATABASE}@${PGHOST}:${PGPORT}"

# -----------------------------------------------------------------------------
# Step 1: Create backup
# -----------------------------------------------------------------------------
log_info "Creating backup: ${BACKUP_FILE}"

if pg_dump \
    -h "${PGHOST}" \
    -p "${PGPORT}" \
    -U "${PGUSER}" \
    -d "${PGDATABASE}" \
    --no-password \
    --format=plain \
    --no-owner \
    --no-privileges \
    --verbose \
    2>/dev/null | gzip > "${BACKUP_PATH}"; then
    log_info "Backup created successfully"
else
    log_error "Failed to create backup"
    exit 1
fi

# -----------------------------------------------------------------------------
# Step 2: Verify backup integrity
# -----------------------------------------------------------------------------
log_info "Verifying backup integrity..."

BACKUP_SIZE=$(stat -f%z "${BACKUP_PATH}" 2>/dev/null || stat -c%s "${BACKUP_PATH}")

if [ "${BACKUP_SIZE}" -lt 1000 ]; then
    log_error "Backup file too small (${BACKUP_SIZE} bytes). Backup may have failed."
    rm -f "${BACKUP_PATH}"
    exit 1
fi

# Test gzip integrity
if gzip -t "${BACKUP_PATH}" 2>/dev/null; then
    log_info "Backup integrity verified (${BACKUP_SIZE} bytes)"
else
    log_error "Backup file is corrupted"
    rm -f "${BACKUP_PATH}"
    exit 1
fi

# -----------------------------------------------------------------------------
# Step 3: Clean up old backups (retention policy)
# -----------------------------------------------------------------------------
log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."

DELETED_COUNT=0
while IFS= read -r old_backup; do
    if [ -f "${old_backup}" ]; then
        rm -f "${old_backup}"
        ((DELETED_COUNT++))
    fi
done < <(find "${BACKUP_DIR}" -name "vms_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}")

if [ "${DELETED_COUNT}" -gt 0 ]; then
    log_info "Deleted ${DELETED_COUNT} old backup(s)"
fi

# -----------------------------------------------------------------------------
# Step 4: Optional - Upload to offsite storage
# -----------------------------------------------------------------------------
# Uncomment and configure for S3:
#
# if command -v aws &> /dev/null; then
#     log_info "Uploading to S3..."
#     aws s3 cp "${BACKUP_PATH}" "s3://${S3_BUCKET}/backups/${BACKUP_FILE}" \
#         --storage-class STANDARD_IA \
#         --sse AES256
#     log_info "Uploaded to S3 successfully"
# fi

# Uncomment and configure for Google Cloud Storage:
#
# if command -v gsutil &> /dev/null; then
#     log_info "Uploading to GCS..."
#     gsutil cp "${BACKUP_PATH}" "gs://${GCS_BUCKET}/backups/${BACKUP_FILE}"
#     log_info "Uploaded to GCS successfully"
# fi

# -----------------------------------------------------------------------------
# Step 5: Summary
# -----------------------------------------------------------------------------
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "vms_backup_*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)

log_info "===== Backup Summary ====="
log_info "Backup file: ${BACKUP_FILE}"
log_info "Backup size: $(du -h "${BACKUP_PATH}" | cut -f1)"
log_info "Total backups: ${TOTAL_BACKUPS}"
log_info "Total storage: ${TOTAL_SIZE}"
log_info "=========================="

exit 0
