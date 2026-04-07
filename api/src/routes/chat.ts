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
/** Max agentic tool-call iterations per response. */
const MAX_TOOL_ITERATIONS = 8;

const router = Router();

// ── Shared helpers ──────────────────────────────────────────────────────────

/** Truncate the first message to produce a working thread title (≤60 chars). */
function deriveTitleFromMessage(message: string): string {
  const trimmed = message.trim();
  return trimmed.length <= 60 ? trimmed : trimmed.slice(0, 57) + "...";
}

/** Load the league with the relations needed to build a system prompt. */
async function loadLeagueForChat(leagueId: string) {
  return prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      seasons: { select: { year: true }, orderBy: { year: "asc" } },
      managers: {
        select: {
          id: true,
          name: true,
          userId: true,
          seasonEntries: {
            select: { teamName: true },
            orderBy: { season: { year: "desc" } },
            take: 1,
          },
        },
      },
    },
  });
}

/** Build the system prompt string from league data and the authenticated user. */
function buildChatSystemPrompt(
  league: NonNullable<Awaited<ReturnType<typeof loadLeagueForChat>>>,
  user: any
): string {
  const seasons = league.seasons.map((s) => s.year);
  const seasonRange =
    seasons.length > 0
      ? seasons.length === 1
        ? String(seasons[0])
        : `${seasons[0]}–${seasons[seasons.length - 1]}`
      : "Unknown";

  const currentUserManager = league.managers.find((m) => m.userId === user.id);

  return buildSystemPrompt({
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
      currentUserManager?.seasonEntries[0]?.teamName ??
      currentUserManager?.name ??
      "Your Team",
  });
}

/** Reconstruct the OpenAI message history array from persisted DB messages. */
async function buildHistoryMessages(threadId: string): Promise<ChatCompletionMessageParam[]> {
  const priorMessages = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_WINDOW,
  });
  // Reverse to chronological order, drop the just-inserted user message (last row)
  const chronological = priorMessages.reverse().slice(0, -1);

  // Build lookup of toolCallId -> tool result for orphan filtering
  const toolResultMap = new Map<string, string>();
  for (const m of chronological) {
    if (m.role === "tool" && m.toolCallId) {
      toolResultMap.set(m.toolCallId, m.content);
    }
  }

  // Reconstruct OpenAI message array, grouping consecutive assistant tool-call
  // rows into a single assistant message and pairing each with its tool result.
  const historyMessages: ChatCompletionMessageParam[] = [];
  let i = 0;
  while (i < chronological.length) {
    const m = chronological[i];

    if (m.role === "assistant" && m.toolName) {
      // Collect consecutive assistant tool-call rows as one logical turn
      const group: typeof chronological = [];
      while (
        i < chronological.length &&
        chronological[i].role === "assistant" &&
        chronological[i].toolName
      ) {
        group.push(chronological[i]);
        i++;
      }
      const complete = group.filter((tc) => tc.toolCallId && toolResultMap.has(tc.toolCallId));
      if (complete.length > 0) {
        historyMessages.push({
          role: "assistant",
          content: null,
          tool_calls: complete.map((tc) => ({
            id: tc.toolCallId ?? "unknown",
            type: "function" as const,
            function: { name: tc.toolName!, arguments: "{}" },
          })),
        });
        for (const tc of complete) {
          historyMessages.push({
            role: "tool" as const,
            tool_call_id: tc.toolCallId ?? "unknown",
            content: toolResultMap.get(tc.toolCallId!) ?? "",
          });
        }
      }
    } else if (m.role === "tool") {
      i++; // emitted inline above; skip standalone tool rows
    } else {
      historyMessages.push({
        role: m.role as "user" | "assistant",
        content: m.content,
      });
      i++;
    }
  }

  return historyMessages;
}

/**
 * Run the full agentic streaming loop (GPT-4o + tool calls).
 * Streams delta/tool_call/done events via sseWrite.
 * Returns the complete assistant text for persistence.
 */
async function runAgenticStream({
  leagueId,
  threadId,
  messages,
  sseWrite,
}: {
  leagueId: string;
  threadId: string;
  messages: ChatCompletionMessageParam[];
  sseWrite: (payload: Record<string, unknown>) => void;
}): Promise<string> {
  let fullAssistantText = "";
  let iterations = 0;

  while (true) {
    iterations++;
    if (iterations > MAX_TOOL_ITERATIONS) break;

    let textBuffer = "";
    const toolCallAccumulators: Map<number, { id: string; name: string; argsJson: string }> =
      new Map();

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

      if (delta.content) {
        textBuffer += delta.content;
        fullAssistantText += delta.content;
        sseWrite({ type: "delta", content: delta.content });
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolCallAccumulators.get(tc.index) ?? { id: "", name: "", argsJson: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.argsJson += tc.function.arguments;
          toolCallAccumulators.set(tc.index, existing);
        }
      }
    }

    if (toolCallAccumulators.size === 0) break; // final text turn — done

    const assembledToolCalls = Array.from(toolCallAccumulators.entries())
      .sort(([a], [b]) => a - b)
      .map(([, tc]) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.argsJson },
      }));

    messages.push({
      role: "assistant",
      content: textBuffer || null,
      tool_calls: assembledToolCalls,
    });

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

    const toolResults = await Promise.all(
      assembledToolCalls.map(async (tc) => {
        sseWrite({ type: "tool_call", toolName: tc.function.name, status: "running" });
        try {
          const args = JSON.parse(tc.function.arguments || "{}");
          const result = await executeTool(tc.function.name, args, leagueId, prisma);
          const content = JSON.stringify(result);
          await prisma.chatMessage.create({
            data: { threadId, role: "tool", content, toolName: tc.function.name, toolCallId: tc.id },
          });
          return { role: "tool" as const, tool_call_id: tc.id, content };
        } catch (toolErr) {
          console.error(`Tool execution failed [${tc.function.name}]:`, toolErr);
          const content = JSON.stringify({
            error: toolErr instanceof Error ? toolErr.message : "Tool execution failed",
          });
          await prisma.chatMessage.create({
            data: { threadId, role: "tool", content, toolName: tc.function.name, toolCallId: tc.id },
          });
          return { role: "tool" as const, tool_call_id: tc.id, content };
        }
      })
    );

    messages.push(...toolResults);
  }

  return fullAssistantText;
}

/**
 * Fire-and-forget: ask gpt-4o-mini to generate a concise thread title
 * from the user's first message, then persist it.
 */
function scheduleAutoTitle(threadId: string, firstMessage: string): void {
  (async () => {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Generate a concise 3-5 word title for a fantasy football chat conversation based on the user's first message. Reply with only the title — no punctuation, no quotes.",
          },
          { role: "user", content: firstMessage },
        ],
        max_tokens: 20,
      });
      const refined = completion.choices[0]?.message?.content?.trim();
      if (refined && refined.length > 0 && refined.length <= 120) {
        await prisma.chatThread.update({
          where: { id: threadId },
          data: { title: refined },
        });
      }
    } catch (err) {
      // Non-critical — the truncated title already works fine
      console.error("Auto-title refinement failed:", err);
    }
  })();
}

// ── Routes ──────────────────────────────────────────────────────────────────

/** POST /api/leagues/:leagueId/chat/threads
 *  Create a named chat thread. title is optional — if omitted, pass firstMessage
 *  to derive a title from the user's opening message. */
router.post("/:leagueId/chat/threads", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { leagueId } = req.params as Record<string, string>;
    const user = (req as any).dbUser;
    const { title, firstMessage } = req.body;

    let resolvedTitle: string;
    if (title && typeof title === "string" && title.trim().length > 0) {
      if (title.trim().length > 120) {
        res.status(400).json({ error: "title must be 120 characters or fewer" });
        return;
      }
      resolvedTitle = title.trim();
    } else if (firstMessage && typeof firstMessage === "string" && firstMessage.trim().length > 0) {
      resolvedTitle = deriveTitleFromMessage(firstMessage);
    } else {
      res.status(400).json({ error: "title or firstMessage is required" });
      return;
    }

    const thread = await prisma.chatThread.create({
      data: { userId: user.clerkId, leagueId, title: resolvedTitle },
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
    const { leagueId } = req.params as Record<string, string>;
    const user = (req as any).dbUser;

    const threads = await prisma.chatThread.findMany({
      where: { leagueId, userId: user.clerkId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { messages: true } } },
    });

    res.json(threads);
  } catch (err) {
    console.error("chat/threads list error:", err);
    res.status(500).json({ error: "Failed to load threads" });
  }
});

/** PATCH /api/leagues/:leagueId/chat/threads/:threadId
 *  Update a thread's title — only the owning user may do this */
router.patch("/:leagueId/chat/threads/:threadId", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { threadId } = req.params as Record<string, string>;
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

    const thread = await prisma.chatThread.findUnique({ where: { id: threadId } });
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    if (thread.userId !== user.clerkId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const updated = await prisma.chatThread.update({
      where: { id: threadId },
      data: { title: title.trim() },
    });

    res.json(updated);
  } catch (err) {
    console.error("chat/threads patch error:", err);
    res.status(500).json({ error: "Failed to update thread" });
  }
});

/** DELETE /api/leagues/:leagueId/chat/threads/:threadId
 *  Delete a thread and all its messages — only the owning user may do this */
router.delete("/:leagueId/chat/threads/:threadId", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { threadId } = req.params as Record<string, string>;
    const user = (req as any).dbUser;

    const thread = await prisma.chatThread.findUnique({ where: { id: threadId } });
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

/** POST /api/leagues/:leagueId/chat/quick
 *  Combo endpoint: atomically creates a thread and streams the first response.
 *
 *  SSE events (in order):
 *    { type: "thread_created", threadId: "...", title: "..." }
 *    { type: "delta",          content: "..." }           (repeated)
 *    { type: "tool_call",      toolName: "...", status: "running" }  (if tools fire)
 *    { type: "done",           messageId: "..." }
 *    { type: "error",          error: "..." }             (on failure)
 *
 *  After res.end(), a background task refines the title using gpt-4o-mini.
 */
router.post("/:leagueId/chat/quick", requireAuth, requireLeagueMember, async (req, res) => {
  const { leagueId } = req.params as Record<string, string>;
  const user = (req as any).dbUser;
  const { content } = req.body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  const userMessage = content.trim();

  // Create thread with auto-derived title
  const title = deriveTitleFromMessage(userMessage);
  const thread = await prisma.chatThread.create({
    data: { userId: user.clerkId, leagueId, title },
  });
  const threadId = thread.id;

  // Load league context
  const league = await loadLeagueForChat(leagueId);
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  // Persist user message
  await prisma.chatMessage.create({
    data: { threadId, role: "user", content: userMessage },
  });

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sseWrite = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Announce thread creation before the first delta
  sseWrite({ type: "thread_created", threadId, title });

  try {
    const systemPrompt = buildChatSystemPrompt(league, user);
    const ragContext = await retrieveContext(userMessage, leagueId, prisma, openai);

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt + ragContext },
      { role: "user", content: userMessage },
    ];

    const fullAssistantText = await runAgenticStream({ leagueId, threadId, messages, sseWrite });

    const assistantMessage = await prisma.chatMessage.create({
      data: { threadId, role: "assistant", content: fullAssistantText },
    });

    // Touch thread for sort order
    await prisma.chatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

    sseWrite({ type: "done", messageId: assistantMessage.id });
    res.end();

    // Async: refine the auto-derived title with a real AI-generated one
    scheduleAutoTitle(threadId, userMessage);
  } catch (err) {
    console.error("chat/quick stream error:", err);
    sseWrite({ type: "error", error: err instanceof Error ? err.message : "Internal server error" });
    res.end();
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
  const { leagueId, threadId } = req.params as Record<string, string>;
  const user = (req as any).dbUser;
  const { content } = req.body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  const userMessage = content.trim();

  // Thread ownership check
  const thread = await prisma.chatThread.findUnique({ where: { id: threadId } });
  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  if (thread.userId !== user.clerkId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Load league context
  const league = await loadLeagueForChat(leagueId);
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  // Persist user message and touch thread
  await prisma.chatMessage.create({ data: { threadId, role: "user", content: userMessage } });
  await prisma.chatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sseWrite = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const systemPrompt = buildChatSystemPrompt(league, user);
    const historyMessages = await buildHistoryMessages(threadId);
    const ragContext = await retrieveContext(userMessage, leagueId, prisma, openai);

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt + ragContext },
      ...historyMessages,
      { role: "user", content: userMessage },
    ];

    const fullAssistantText = await runAgenticStream({ leagueId, threadId, messages, sseWrite });

    const assistantMessage = await prisma.chatMessage.create({
      data: { threadId, role: "assistant", content: fullAssistantText },
    });

    sseWrite({ type: "done", messageId: assistantMessage.id });
    res.end();
  } catch (err) {
    console.error("chat/messages stream error:", err);
    sseWrite({ type: "error", error: err instanceof Error ? err.message : "Internal server error" });
    res.end();
  }
});

/** GET /api/leagues/:leagueId/chat/threads/:threadId/messages
 *  Retrieve message history for a thread, paginated by timestamp cursor */
router.get("/:leagueId/chat/threads/:threadId/messages", requireAuth, requireLeagueMember, async (req, res) => {
  try {
    const { threadId } = req.params as Record<string, string>;
    const user = (req as any).dbUser;

    const thread = await prisma.chatThread.findUnique({ where: { id: threadId } });
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    if (thread.userId !== user.clerkId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const rawLimit = parseInt(req.query.limit as string, 10);
    const limit = isNaN(rawLimit) ? 50 : Math.min(200, Math.max(1, rawLimit));
    const before = req.query.before as string | undefined;

    const where: any = { threadId, role: { in: ["user", "assistant"] } };
    if (before) {
      const beforeDate = new Date(before);
      if (isNaN(beforeDate.getTime())) {
        res.status(400).json({ error: "before must be a valid ISO timestamp" });
        return;
      }
      where.createdAt = { lt: beforeDate };
    }

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
