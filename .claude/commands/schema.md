Inspect or modify the Prisma database schema.

If no arguments provided ($ARGUMENTS is empty):
1. Read `api/prisma/schema.prisma` and provide a summary of all models, their relationships, and any enums
2. Note which models are actively used by API endpoints vs which are defined but unused

If arguments describe a change (e.g., "add a notes field to managers"):
1. Read the current schema
2. Make the requested change to `api/prisma/schema.prisma`
3. Show the diff of what changed
4. Remind the user to run `cd api && npx prisma migrate dev --name <description>` when they have a database connected
5. If the change affects API responses, update the corresponding Swift models in `ios/FantasyHub/Models/LeagueModels.swift`
