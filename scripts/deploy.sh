#!/usr/bin/env bash
set -euo pipefail

# Deploy script for UC-03 Azure Container App
# Usage: ./scripts/deploy.sh [IMAGE_TAG] [ENV_FILE]
# Example: ./scripts/deploy.sh v0.1.0 infra/dev.tfvars
# Rollback: ./scripts/deploy.sh <previous_tag> infra/dev.tfvars

IMAGE_TAG="${1:-latest}"
ENV_FILE="${2:-infra/dev.tfvars}"

echo "========================================="
echo " Deploying UC-03 Connection Health SaaS"
echo " Image Tag: ${IMAGE_TAG}"
echo " Env File:  ${ENV_FILE}"
echo "========================================="

if [ ! -f "${ENV_FILE}" ]; then
  echo "Error: Environment file ${ENV_FILE} not found."
  exit 1
fi

cd "$(dirname "$0")/../infra"

echo "Step 1: Terraform Init..."
terraform init -input=false

echo "Step 2: Terraform Plan..."
terraform plan -var-file="../${ENV_FILE}" -var="image_tag=${IMAGE_TAG}" -out=tfplan

echo "Step 3: Terraform Apply..."
terraform apply -input=false tfplan
rm -f tfplan

echo "Step 4: Idempotency validation (second plan must show NO changes)..."
terraform plan -var-file="../${ENV_FILE}" -var="image_tag=${IMAGE_TAG}" -detailed-exitcode

echo "Deployment completed successfully."
