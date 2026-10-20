#!/usr/bin/env bash
set -euo pipefail

# Cleanup script for UC-03
# Destructive cleanup requiring EXPLICIT confirmation

ENV_FILE="${1:-infra/dev.tfvars}"

echo "=========================================================="
echo " WARNING: DESTRUCTIVE ACTION REQUESTED"
echo " You are about to destroy resources defined in ${ENV_FILE}"
echo "=========================================================="

read -r -p "Are you absolutely sure you want to destroy these resources? Type 'CONFIRM-DESTROY' to proceed: " CONFIRMATION

if [ "${CONFIRMATION}" != "CONFIRM-DESTROY" ]; then
  echo "Cleanup aborted. User did not provide explicit confirmation 'CONFIRM-DESTROY'."
  exit 1
fi

cd "$(dirname "$0")/../infra"

echo "Destroying Terraform managed resources..."
terraform destroy -var-file="../${ENV_FILE}" -auto-approve

echo "Cleanup completed."
