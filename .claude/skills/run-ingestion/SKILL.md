---
name: run-ingestion
description: Queue a signal ingestion job for REDDIT, FANTASYPROS, SPORTSDATA, or all sources
disable-model-invocation: true
---

Queue a BullMQ ingestion job and report the result. Argument is the source name: REDDIT, FANTASYPROS, SPORTSDATA, or "all" (default).

Run this script from the api/ directory:

```bash
cd /Users/fnardone/Desktop/frank/claude-playground/fantasy-hub/api

SOURCE="${ARGUMENTS:-all}"
SOURCE_UPPER=$(echo "$SOURCE" | tr '[:lower:]' '[:upper:]')

cat > /tmp/run-ingestion-job.ts << EOF
import { Queue } from "bullmq";
import { redisConnection } from "./src/lib/redis";
async function main() {
  const q = new Queue("ingest-signals", { connection: redisConnection });
  const source = process.argv[1];
  const payload = source === "ALL" ? {} : { source };
  const job = await q.add("ingest-signals", payload);
  console.log("Queued job " + job.id + " for source: " + (source === "ALL" ? "all adapters" : source));
  await q.close();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
EOF

npx tsx /tmp/run-ingestion-job.ts -- "$SOURCE_UPPER"
rm /tmp/run-ingestion-job.ts

echo ""
echo "Check ingestion_jobs table for status:"
psql postgresql://fnardone@localhost:5432/fantasy_hub -c \
  "SELECT source, status, records_fetched, error, last_run_at FROM ingestion_jobs ORDER BY last_run_at DESC LIMIT 5;" 2>/dev/null
```
