import { Router } from "express";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { prisma } from "../lib/prisma";
import { requireAuth, requireLeagueMember } from "../middleware/auth";
import { buildSystemPrompt } from "../lib/ai/prompt";
import { toolDefinitions, executeTool } from "../lib/ai/tools";
import { retrieveContext } from "../lib/ai/rag";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** How many prior messages to send as conversation history. */
const HISTORY_WINDOW = parseInt(process.env.CHAT_HISTORY_WINDOW ?? "20", 10);

const router = Router();

/** POST /api/leagues/:leagueId/chat/threads
 *  Create a new chat thread for the authenticated user in the given league */
router.post("/:leagueId/chat/threads", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params;
    const user = (req as any).dbUser;
    const { title } = req.body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (title.trim().length > 120) {
      res.status(400).json({ error: "title must be 120 characters or fewer" });
      return;
    }

    const thread = await prisma.chatThread.create({
      data: {
        userId: user.clerkId, // Clerk user ID stored directly per spec §4.1
        leagueId,
        title: title.trim(),
      },
    });

    res.status(201).json(thread);
  } catch (err) {
    console.error("chat/threads create error:", err);
    res.status(500).json({ error: "Failed to create thread" });
  }
});

/** GET /api/leagues/:leagueId/chat/threads
 *  List all threads for the authenticated user in this league, most recently active first */
router.get("/:leagueId/chat/threads", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params;
    const user = (req as any).dbUser;

    const threads = await prisma.chatThread.findMany({
      where: {
        leagueId,
        userId: user.clerkId,
      },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { messages: true } },
      },
    });

    res.json(threads);
  } catch (err) {
    console.error("chat/threads list error:", err);
    res.status(500).json({ error: "Failed to load threads" });
  }
});

/** DELETE /api/leagues/:leagueId/chat/threads/:threadId
 *  Delete a thread and all its messages — only the owning user may do this */
router.delete("/:leagueId/chat/threads/:threadId", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { threadId } = req.params;
    const user = (req as any).dbUser;

    const thread = await prisma.chatThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    if (thread.userId !== user.clerkId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await prisma.chatThread.delete({ where: { id: threadId } });

    res.status(204).send();
  } catch (err) {
    console.error("chat/threads delete error:", err);
    res.status(500).json({ error: "Failed to delete thread" });
  }
});

/** POST /api/leagues/:leagueId/chat/threads/:threadId/messages
 *  Send a message and stream the GPT-4o assistant response via SSE.
 *
 *  SSE event format — all events are `data: <json>\n\n` with a `type` field:
 *    { type: "delta",     content: "..." }
 *    { type: "tool_call", toolName: "...", status: "running" }
 *    { type: "done",      messageId: "..." }
 *    { type: "error",     error: "..." }
 */
router.post("/:leagueId/chat/threads/:threadId/messages", requireAuth, requireLeagueMember, async (req, res) => {
  const { leagueId, threadId } = req.params;
  const user = (req as any).dbUser;
  const { content } = req.body;

  // ── Input validation ────────────────────────────────────────────────────
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  const userMessage = content.trim();

  // ── Thread ownership check ──────────────────────────────────────────────
  const thread = await prisma.chatThread.findUnique({ where: { id: threadId } });
  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  if (thread.userId !== user.clerkId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // ── Load league + managers for system prompt ────────────────────────────
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      seasons: { select: { year: true }, orderBy: { year: "asc" } },
      managers: {
        select: {
          id: true,
          name: true,
          userId: true,
          seasonEntries: { select: { teamName: true }, orderBy: { season: { year: "desc" } }, take: 1 },
        },
      },
    },
  });

  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  // Resolve current user's manager (by linked userId)
  const currentUserManager = league.managers.find((m) => m.userId === user.id);

  const seasons = league.seasons.map((s) => s.year);
  const seasonRange =
    seasons.length > 0
      ? seasons.length === 1
        ? String(seasons[0])
        : `${seasons[0]}–${seasons[seasons.length - 1]}`
      : "Unknown";

  const systemPrompt = buildSystemPrompt({
    leagueName: league.name,
    platform: league.provider.toLowerCase(),
    scoringType: league.scoringType ?? "Unknown",
    seasons: seasonRange,
    teamCount: league.teamCount ?? league.managers.length,
    managers: league.managers.map((m) => ({
      name: m.name,
      teamName: m.seasonEntries[0]?.teamName ?? m.name,
      isCurrentUser: m.userId === user.id,
    })),
    currentUserName: user.name ?? user.email ?? "You",
    currentUserTeamName:
      currentUserManager?.seasonEntries[0]?.teamName ?? currentUserManager?.name ?? "Your Team",
  });

  // ── Persist user message ────────────────────────────────────────────────
  await prisma.chatMessage.create({
    data: { threadId, role: "user", content: userMessage },
  });

  // Touch thread so the list stays sorted by most-recent activity
  await prisma.chatThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  // ── SSE headers — must be sent before any async work that could fail ────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Helper: write a typed SSE event
  const sseWrite = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    // ── Conversation history (last N messages) ────────────────────────────
    const priorMessages = await prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_WINDOW,
    });
    // Reverse to chronological order (oldest first) and exclude the message
    // we just inserted — the user turn is appended explicitly below.
    const historyMessages: ChatCompletionMessageParam[] = priorMessages
      .reverse()
      .slice(0, -1) // drop the user message we just saved
      .map((m) => {
        if (m.role === "tool") {
          return {
            role: "tool" as const,
            tool_call_id: m.toolCallId ?? "unknown",
            content: m.content,
          };
        }
        if (m.role === "assistant" && m.toolName) {
          return {
            role: "assistant" as const,
            content: null,
            tool_calls: [
              {
                id: m.toolCallId ?? "unknown",
                type: "function" as const,
                function: { name: m.toolName, arguments: "{}" },
              },
            ],
          };
        }
        return {
          role: m.role as "user" | "assistant",
          content: m.content,
        };
      });

    // ── RAG context ───────────────────────────────────────────────────────
    const ragContext = await retrieveContext(userMessage, leagueId, prisma, openai);

    // ── Build the OpenAI messages array ───────────────────────────────────
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt + ragContext },
      ...historyMessages,
      { role: "user", content: userMessage },
    ];

    // ── Streaming loop ────────────────────────────────────────────────────
    // GPT-4o may emit multiple tool calls in one turn, each followed by
    // continued text generation. We handle the full agentic loop here:
    //
    //   1. Stream from OpenAI.
    //   2. Accumulate text deltas + tool call fragments.
    //   3. When stream finishes:
    //      a. If there are tool calls → execute them all, append results to
    //         messages, and loop back to step 1.
    //      b. If no tool calls → we have the final text; break.
    //
    // All text deltas are streamed to the client in real time. Tool results
    // are fed back silently (the model sees them; the client sees a
    // tool_call status event only).

    let fullAssistantText = "";
    let continueLoop = true;
    let iterations = 0;
    const MAX_TOOL_ITERATIONS = 8;

    while (continueLoop) {
      iterations++;
      if (iterations > MAX_TOOL_ITERATIONS) { continueLoop = false; break; }
      // Accumulate state for this streaming pass
      let textBuffer = "";

      // Tool call accumulation: keyed by index (OpenAI may stream multiple
      // tool calls interleaved, each identified by an index in the chunk).
      const toolCallAccumulators: Map<
        number,
        { id: string; name: string; argsJson: string }
      > = new Map();

      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        stream: true,
        messages,
        tools: toolDefinitions,
        tool_choice: "auto",
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // Text delta
        if (delta.content) {
          textBuffer += delta.content;
          fullAssistantText += delta.content;
          sseWrite({ type: "delta", content: delta.content });
        }

        // Tool call fragment — accumulate across chunks
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallAccumulators.get(tc.index) ?? {
              id: "",
              name: "",
              argsJson: "",
            };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.argsJson += tc.function.arguments;
            toolCallAccumulators.set(tc.index, existing);
          }
        }
      }

      // ── After this streaming pass ───────────────────────────────────────
      if (toolCallAccumulators.size === 0) {
        // No tool calls — this is the final text turn. Exit the loop.
        continueLoop = false;
      } else {
        // There are tool calls to execute. Build the assistant message with
        // the accumulated tool_calls array so the model sees its own calls.
        const assembledToolCalls = Array.from(toolCallAccumulators.entries())
          .sort(([a], [b]) => a - b)
          .map(([, tc]) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.argsJson },
          }));

        // Append the assistant turn (with its tool_calls) to the message list
        messages.push({
          role: "assistant",
          content: textBuffer || null,
          tool_calls: assembledToolCalls,
        });

        // Persist one ChatMessage per tool call (assistant role) so history
        // reconstruction can rebuild the correct OpenAI message shape.
        await Promise.all(
          assembledToolCalls.map((tc) =>
            prisma.chatMessage.create({
              data: {
                threadId,
                role: "assistant",
                content: "",
                toolName: tc.function.name,
                toolCallId: tc.id,
              },
            })
          )
        );

        // Execute all tool calls (in parallel) and append results
        const toolResults = await Promise.all(
          assembledToolCalls.map(async (tc) => {
            sseWrite({ type: "tool_call", toolName: tc.function.name, status: "running" });
            try {
              const args = JSON.parse(tc.function.arguments || "{}");
              const result = await executeTool(tc.function.name, args, leagueId, prisma);
              const content = JSON.stringify(result);
              // Persist tool result message with toolCallId for history replay
              await prisma.chatMessage.create({
                data: {
                  threadId,
                  role: "tool",
                  content,
                  toolName: tc.function.name,
                  toolCallId: tc.id,
                },
              });
              return {
                role: "tool" as const,
                tool_call_id: tc.id,
                content,
              };
            } catch (toolErr) {
              console.error(`Tool execution failed [${tc.function.name}]:`, toolErr);
              const content = JSON.stringify({
                error: toolErr instanceof Error ? toolErr.message : "Tool execution failed",
              });
              await prisma.chatMessage.create({
                data: {
                  threadId,
                  role: "tool",
                  content,
                  toolName: tc.function.name,
                  toolCallId: tc.id,
                },
              });
              return {
                role: "tool" as const,
                tool_call_id: tc.id,
                content,
              };
            }
          })
        );

        // Append all tool results, then loop — the model will generate its
        // response incorporating those results.
        messages.push(...toolResults);
      }
    }

    // ── Persist the full assistant response ───────────────────────────────
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        threadId,
        role: "assistant",
        content: fullAssistantText,
      },
    });

    sseWrite({ type: "done", messageId: assistantMessage.id });
    res.end();
  } catch (err) {
    // Headers are already sent — use SSE error event, not HTTP status
    console.error("chat/messages stream error:", err);
    sseWrite({
      type: "error",
      error: err instanceof Error ? err.message : "Internal server error",
    });
    res.end();
  }
});

/** GET /api/leagues/:leagueId/chat/threads/:threadId/messages
 *  Retrieve message history for a thread, paginated by timestamp cursor */
router.get("/:leagueId/chat/threads/:threadId/messages", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { threadId } = req.params;
    const user = (req as any).dbUser;

    // Verify thread ownership
    const thread = await prisma.chatThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    if (thread.userId !== user.clerkId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    // Parse pagination params
    const rawLimit = parseInt(req.query.limit as string, 10);
    const limit = isNaN(rawLimit) ? 50 : Math.min(200, Math.max(1, rawLimit));
    const before = req.query.before as string | undefined;

    const where: any = { threadId };
    if (before) {
      const beforeDate = new Date(before);
      if (isNaN(beforeDate.getTime())) {
        res.status(400).json({ error: "before must be a valid ISO timestamp" });
        return;
      }
      where.createdAt = { lt: beforeDate };
    }

    // Fetch one extra to determine whether more pages exist
    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    res.json({ messages, hasMore });
  } catch (err) {
    console.error("chat/messages list error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

export default router;
