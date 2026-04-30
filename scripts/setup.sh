#!/bin/bash
set -e

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  bun install
fi

echo "🔧 Generating Prisma client..."
bun --bun run prisma generate

# Generate Prisma client if missing or schema has changed
if [ ! -d "src/generated/prisma" ] || [ "prisma/schema.prisma" -nt "src/generated/prisma/client.ts" ]; then
  # Clear Next.js cache when Prisma client is regenerated
  if [ -d ".next" ]; then
    echo "🗑️  Clearing Next.js cache..."
    rm -rf .next
  fi
fi

echo "✅ Setup complete!"
