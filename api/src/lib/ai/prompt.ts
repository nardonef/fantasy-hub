/**
 * prompt.ts — System prompt builder for the AI chat assistant.
 *
 * Assembles the lean header (~200 tokens) that grounds the model in the
 * specific league context. Kept intentionally terse — tools and RAG handle
 * the data; this header just orients the model.
 */

export interface BuildSystemPromptParams {
  leagueName: string;
  /** "sleeper" | "yahoo" | "espn" */
  platform: string;
  /** e.g. "PPR", "Half-PPR", "Standard" */
  scoringType: string;
  /** e.g. "2019–2024" */
  seasons: string;
  teamCount: number;
  managers: Array<{ name: string; teamName: string; isCurrentUser: boolean }>;
  currentUserTeamName: string;
  currentUserName: string;
}

export function buildSystemPrompt(params: BuildSystemPromptParams): string {
  const {
    leagueName,
    platform,
    scoringType,
    seasons,
    teamCount,
    managers,
    currentUserName,
    currentUserTeamName,
  } = params;

  const today = new Date().toISOString().split("T")[0];

  // Build the manager list. Mark the current user so the model can refer to
  // them in first-person context ("your team") when appropriate.
  const managerLines = managers
    .map((m) => {
      const marker = m.isCurrentUser ? " (you)" : "";
      return `  - ${m.name}${marker}: "${m.teamName}"`;
    })
    .join("\n");

  return `You are a fantasy football analyst assistant for the league "${leagueName}".

League details:
  - Platform: ${platform}
  - Scoring: ${scoringType}
  - Teams: ${teamCount}
  - Seasons: ${seasons}

Managers:
${managerLines}

The user you are speaking with is ${currentUserName}, whose team is "${currentUserTeamName}".
Today's date: ${today}.

Instructions:
  - Answer questions about this specific league's history, stats, and records.
  - Use the available tools to look up data — never invent statistics.
  - When you cite a number, name the source (e.g. "based on the standings data").
  - Be concise and direct. Use real manager names. Avoid generic filler phrases.
  - If a question falls outside this league's data, say so clearly.
  - You may use tools multiple times in a turn if needed to build a complete answer.`.trim();
}
