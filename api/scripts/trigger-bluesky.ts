import "dotenv/config";
import { ingestionQueue, startIngestionWorker } from "../src/jobs/ingest-signals";

async function main(): Promise<void> {
  startIngestionWorker();
  await ingestionQueue.add("ingest-signals", { source: "BLUESKY" });
  console.log("Job enqueued — waiting for worker...");
  await new Promise((r) => setTimeout(r, 25000));
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
