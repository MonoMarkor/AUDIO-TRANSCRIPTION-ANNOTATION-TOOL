docker run --rm -it -v "${PWD}/frontend:/app" -w /app node:22-alpine sh -c "npm create vue@latest . -- --typescript --router false --pinia false --vitest false --eslint"

docker run --rm -v "${PWD}/backend:/app" -w /app node:22-alpine sh -c "
  npm init -y &&
  npm install express &&
  npm install -D typescript @types/express @types/node ts-node-dev prisma &&
  npx tsc --init &&
  npx prisma init
"