#!/bin/bash
# =============================================================================
# Database Restore Script
# Voter Management System - Production
# =============================================================================
#
# Usage:
#   ./restore.sh                    # List available backups
#   ./restore.sh latest             # Restore most recent backup
#   ./restore.sh vms_backup_xxx.sql.gz  # Restore specific backup
#
# WARNING: This will overwrite the current database!
#

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"

# Database credentials
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${POSTGRES_USER:-vms_user}"
PGPASSWORD="${POSTGRES_PASSWORD}"
PGDATABASE="${POSTGRES_DB:-voter_management}"

export PGPASSWORD

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# List available backups
list_backups() {
    log_info "Available backups:"
    echo ""
    ls -lh "${BACKUP_DIR}"/vms_backup_*.sql.gz 2>/dev/null | awk '{print "  " $NF " (" $5 ")"}'
    echo ""
}

# Get latest backup
get_latest_backup() {
    ls -t "${BACKUP_DIR}"/vms_backup_*.sql.gz 2>/dev/null | head -1
}

# Main
if [ $# -eq 0 ]; then
    list_backups
    log_info "Usage: $0 [latest|backup_filename.sql.gz]"
    exit 0
fi

BACKUP_FILE="$1"

if [ "${BACKUP_FILE}" = "latest" ]; then
    BACKUP_FILE=$(get_latest_backup)
    if [ -z "${BACKUP_FILE}" ]; then
        log_error "No backups found in ${BACKUP_DIR}"
        exit 1
    fi
    log_info "Latest backup: ${BACKUP_FILE}"
fi

# Resolve full path
if [[ ! "${BACKUP_FILE}" = /* ]]; then
    BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
fi

if [ ! -f "${BACKUP_FILE}" ]; then
    log_error "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Confirmation
echo ""
log_warn "============================================"
log_warn "          DATABASE RESTORE WARNING          "
log_warn "============================================"
echo ""
log_warn "This will OVERWRITE the database: ${PGDATABASE}"
log_warn "Backup file: ${BACKUP_FILE}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    log_info "Restore cancelled."
    exit 0
fi

# Create a backup before restore
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PRE_RESTORE_BACKUP="${BACKUP_DIR}/pre_restore_${TIMESTAMP}.sql.gz"

log_info "Creating pre-restore backup..."
pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" \
    --no-password --format=plain | gzip > "${PRE_RESTORE_BACKUP}"
log_info "Pre-restore backup: ${PRE_RESTORE_BACKUP}"

# Drop and recreate database
log_info "Dropping existing database..."
psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d postgres \
    --no-password -c "DROP DATABASE IF EXISTS ${PGDATABASE};" 2>/dev/null

log_info "Creating fresh database..."
psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d postgres \
    --no-password -c "CREATE DATABASE ${PGDATABASE};" 2>/dev/null

# Restore
log_info "Restoring from backup..."
gunzip -c "${BACKUP_FILE}" | psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" \
    -d "${PGDATABASE}" --no-password -q

log_info "Database restored successfully!"
log_info "Pre-restore backup available at: ${PRE_RESTORE_BACKUP}"

exit 0
