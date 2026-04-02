Create or update a feature spec for: $ARGUMENTS

1. Read existing specs in `docs/features/` for style reference (see `analytics-spec.md`)
2. Research the feature:
   - What data does it need? Check the Prisma schema (`api/prisma/schema.prisma`)
   - What API endpoints exist or are needed? Check `api/src/routes/`
   - Are there reference implementations? (e.g., Blake's Shoes at `~/Desktop/frank/blakes-shoes/`)
3. Write the spec to `docs/features/{feature-name}.md` with:
   - Overview (what and why)
   - Data requirements (tables, fields, calculations)
   - UI sections (preview and detail views)
   - API endpoints needed (with status: Built / TODO)
   - Design notes (following Broadcast Dark + Trophy Gold theme)
4. Update `docs/progress.md` if this reveals new work items
