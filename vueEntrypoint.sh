#!/bin/sh
set -e

corepack enable

if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  yarn install
fi

echo "Starting Vue dev server..."
yarn dev --host 0.0.0.0