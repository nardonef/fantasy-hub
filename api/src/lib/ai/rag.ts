/**
 * rag.ts — Semantic retrieval for the AI chat assistant.
 *
 * Embeds the user's query and searches the ChatEmbedding table (pgvector)
 * for the top-3 most relevant chunks scoped to the league.
 *
 * STATUS: The ChatEmbedding table and pgvector extension are deferred to a
 * separate migration (Decision 022). This function degrades gracefully —
 * if the table does not exist yet, it returns an empty string and logs a
 * warning. It will NOT throw; the calling code must never depend on RAG
 * being populated.
 *
 * Once the embedding pipeline migration lands:
 *   1. Run: npx prisma migrate dev --name add_chat_embeddings
 *   2. Remove the early-return guard below.
 *   3. The pgvector similarity query will activate automatically.
 */

import type { PrismaClient } from "../../generated/prisma/client";
import type OpenAI from "openai";

/** Number of RAG chunks to inject into the prompt. */
const TOP_K = 3;

/**
 * Retrieves semantically relevant context for a user query within a league.
 *
 * Returns a formatted string ready to be appended after the system prompt
 * header, or an empty string if RAG is unavailable or returns no results.
 */
export async function retrieveContext(
  query: string,
  leagueId: string,
  prisma: PrismaClient,
  openai: OpenAI
): Promise<string> {
  try {
    // ── Guard: ChatEmbedding table not yet migrated ──────────────────────────
    // The embedding table requires a separate migration (pgvector extension).
    // Check whether the table exists by introspecting the information schema.
    // This check is safe to remove once the migration is applied.
    const tableCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'ChatEmbedding'
      ) AS "exists"
    `;

    if (!tableCheck[0]?.exists) {
      // Embedding pipeline not yet deployed — RAG is a no-op.
      return "";
    }

    // ── Embed the query ──────────────────────────────────────────────────────
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryVector = embeddingResponse.data[0].embedding;

    // ── pgvector similarity search ──────────────────────────────────────────
    // Uses the <=> operator (cosine distance) from the pgvector extension.
    // Returns the top-K most relevant chunks for this league.
    const rows = await prisma.$queryRaw<Array<{ content: string; entity_type: string }>>`
      SELECT content, "entityType" AS entity_type
      FROM "ChatEmbedding"
      WHERE "leagueId" = ${leagueId}
      ORDER BY embedding <=> ${JSON.stringify(queryVector)}::vector
      LIMIT ${TOP_K}
    `;

    if (!rows || rows.length === 0) {
      return "";
    }

    // ── Format chunks for injection ─────────────────────────────────────────
    const chunks = rows
      .map((row, i) => `[Context ${i + 1} — ${row.entity_type}]\n${row.content}`)
      .join("\n\n");

    return `\n\n---\nRelevant historical context:\n${chunks}\n---`;
  } catch (err) {
    // RAG failures must never break the response. Log and continue.
    console.warn("RAG retrieval failed (non-fatal):", err instanceof Error ? err.message : err);
    return "";
  }
}
