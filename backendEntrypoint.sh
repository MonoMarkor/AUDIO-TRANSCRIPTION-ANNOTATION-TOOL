#!/bin/sh
set -e

corepack enable

if [ ! -d "node_modules" ]; then
  echo "Installing backend dependencies..."
  yarn install
fi

echo "Applying Prisma migrations..."
yarn prisma migrate deploy

echo "Starting backend dev server..."
yarn dev