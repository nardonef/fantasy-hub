Start the Fantasy Hub API for local development.

1. Check prerequisites:
   - Run `which node` to confirm Node.js is installed
   - Check if PostgreSQL is running: `pg_isready` or `brew services list | grep postgresql`
   - Check if Redis is running: `redis-cli ping` or `brew services list | grep redis`
2. If PostgreSQL or Redis aren't running, start them: `brew services start postgresql@17` and `brew services start redis`
3. Check if `.env` exists in `api/` — if not, copy from `.env.example` and remind user to fill in values
4. Check if `node_modules` exists — if not, run `cd api && npm install`
5. Check if Prisma client is generated — if not, run `cd api && npx prisma generate`
6. Start the dev server: `cd api && npm run dev`
