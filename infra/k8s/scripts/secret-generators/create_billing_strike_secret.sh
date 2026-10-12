#!/usr/bin/env bash
# VERSION: 1
# SOPS Secret podverse-billing-strike-opaque: Strike API credentials.
# Mounted with envFrom on the API, management API, and worker-billing-reconcile.
# Does not support --auto-gen. See docs/billing/BILLING.md.

set -euo pipefail

OUTPUT_FILE_OVERRIDE=""

while [[ $# -gt 0 ]]; do
	case "${1}" in
	--output-file)
		OUTPUT_FILE_OVERRIDE="${2:?--output-file requires a value}"
		shift 2
		;;
	*)
		break
		;;
	esac
done

echo "Running create_billing_strike_secret.sh - Version: 1"

read -r -p "Enter environment [alpha]: " ENVIRONMENT
ENVIRONMENT="${ENVIRONMENT:-alpha}"

SECRET_NAME="podverse-billing-strike-opaque"
NAMESPACE="podverse-${ENVIRONMENT}"
OUTPUT_FILE="./secrets/podverse-${ENVIRONMENT}-billing-strike-opaque.enc.yaml"

if [ -n "$OUTPUT_FILE_OVERRIDE" ]; then
	OUTPUT_FILE="$OUTPUT_FILE_OVERRIDE"
fi

echo "--- Strike (leave blank to keep the processor off) ---"
read -r -s -p "Enter STRIKE_API_KEY: " STRIKE_API_KEY
echo ""
read -r -s -p "Enter STRIKE_WEBHOOK_SECRET: " STRIKE_WEBHOOK_SECRET
echo ""

mkdir -p "$(dirname "$OUTPUT_FILE")"
echo "Generating and encrypting secret..."

TMP_YAML_DIR="$(mktemp -d "${TMPDIR:-/tmp}/billing-strike-secret-yaml.XXXXXX")"
TMP_FILE="${TMP_YAML_DIR}/podverse-billing-strike-opaque.yaml"
trap 'rm -rf "$TMP_YAML_DIR"' EXIT

kubectl create secret generic "${SECRET_NAME}" \
	--namespace "${NAMESPACE}" \
	--from-literal=STRIKE_API_KEY="${STRIKE_API_KEY}" \
	--from-literal=STRIKE_WEBHOOK_SECRET="${STRIKE_WEBHOOK_SECRET}" \
	--dry-run=client -o yaml >"${TMP_FILE}"

sops --encrypt --encrypted-regex '^(data|stringData)$' \
	--input-type=yaml "${TMP_FILE}" >"${OUTPUT_FILE}"

rm -rf "$TMP_YAML_DIR"
trap - EXIT

echo "----------------------------------------------------"
echo "SUCCESS: Encrypted secret created at ${OUTPUT_FILE}"
echo "----------------------------------------------------"
echo "Verify: sops -d ${OUTPUT_FILE}"
echo "Apply:  sops -d ${OUTPUT_FILE} | kubectl apply -f -"
