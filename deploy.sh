#!/bin/bash
#
# One-click deploy 

echo "==> Pulling latest (branch: master)"
git pull origin master

echo "==> Installing dependencies (npm ci)"
npm ci

echo "==> Building app"
npm run build


echo "==> Starting/Restarting pm2 app from ecosystem.config.js"
pm2 startOrRestart ecosystem.config.js

echo ""
echo "Deployment complete."