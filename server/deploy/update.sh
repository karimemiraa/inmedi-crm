#!/usr/bin/env bash
# Neueste Version holen, CRM bauen, Eingangs-Server neu starten.
#   sudo /opt/inmedi-crm/server/deploy/update.sh
set -euo pipefail
cd /opt/inmedi-crm
git pull --ff-only
npm ci --no-audit --no-fund
npm run build
cd server
npm ci --omit=dev --no-audit --no-fund
systemctl restart inmedi-intake
sleep 2
systemctl --no-pager --lines=5 status inmedi-intake
