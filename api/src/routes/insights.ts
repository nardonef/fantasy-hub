import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireLeagueMember } from "../middleware/auth";

const router = Router();

// Simple in-memory cache: key -> { data, expires }
const insightCache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface InsightResult {
  id: string;
  type: string;
  headline: string;
  detail: string | null;
  stat: string;
  statLabel: string;
  managerName: string | null;
  analyticsPath: string;
  priority: number;
}

/** GET /api/leagues/:leagueId/analytics/insights
 *  Auto-generated personal insights for the authenticated user's claimed manager */
router.get(
  "/:leagueId/analytics/insights",
  requireAuth,
  requireLeagueMember,
  async (req, res) => {
    try {
      const { leagueId } = req.params as Record<string, string>;
      const user = (req as any).dbUser;

      // Find user's claimed manager
      const manager = await prisma.manager.findFirst({
        where: { leagueId, userId: user.id },
        select: { id: true, name: true },
      });

      if (!manager) {
        res.json({ insights: [] });
        return;
      }

      // Check cache
      const cacheKey = `${leagueId}:${manager.id}`;
      const cached = insightCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        res.json({ insights: cached.data });
        return;
      }

      // Fetch all matchups for insight generation
      const matchups = await prisma.matchup.findMany({
        where: {
          season: { leagueId },
          homeScore: { not: null },
          awayScore: { not: null },
        },
        include: {
          homeManager: { select: { id: true, name: true } },
          awayManager: { select: { id: true, name: true } },
          season: { select: { year: true } },
        },
        orderBy: [{ season: { year: "asc" } }, { week: "asc" }],
      });

      const insights: InsightResult[] = [];
      let priority = 1;

      // --- 1. Active H2H Streaks ---
      const opponentMatchups = new Map<
        string,
        { name: string; results: { won: boolean; year: number; week: number }[] }
      >();

      for (const m of matchups) {
        if (m.homeScore === null || m.awayScore === null) continue;
        const isHome = m.homeManagerId === manager.id;
        const isAway = m.awayManagerId === manager.id;
        if (!isHome && !isAway) continue;

        const opponentId = isHome ? m.awayManagerId : m.homeManagerId;
        const opponentName = isHome ? m.awayManager.name : m.homeManager.name;
        const myScore = isHome ? m.homeScore : m.awayScore;
        const theirScore = isHome ? m.awayScore : m.homeScore;

        const entry = opponentMatchups.get(opponentId) ?? {
          name: opponentName,
          results: [],
        };
        entry.results.push({
          won: myScore > theirScore,
          year: m.season.year,
          week: m.week,
        });
        opponentMatchups.set(opponentId, entry);
      }

      for (const [, opp] of opponentMatchups) {
        const recent = opp.results.slice(-10);
        let streak = 0;
        let streakType: boolean | null = null;

        for (let i = recent.length - 1; i >= 0; i--) {
          if (streakType === null) {
            streakType = recent[i].won;
            streak = 1;
          } else if (recent[i].won === streakType) {
            streak++;
          } else {
            break;
          }
        }

        if (streak >= 3 && streakType === true) {
          insights.push({
            id: `streak-${opp.name.toLowerCase().replace(/\s/g, "-")}`,
            type: "streak",
            headline: `You've won **${streak} straight** against ${opp.name}`,
            detail: "Active winning streak",
            stat: `${streak}-0`,
            statLabel: `Last ${streak}`,
            managerName: opp.name,
            analyticsPath: "h2h",
            priority: priority++,
          });
        }

        // Close rivalry
        const total = opp.results.length;
        if (total >= 6) {
          const wins = opp.results.filter((r) => r.won).length;
          const losses = total - wins;
          if (Math.abs(wins - losses) <= 1) {
            insights.push({
              id: `rivalry-${opp.name.toLowerCase().replace(/\s/g, "-")}`,
              type: "rivalry",
              headline: `Dead-even rivalry: you and **${opp.name}** are **${wins}-${losses}**`,
              detail: `${total} total matchups`,
              stat: `${wins}-${losses}`,
              statLabel: "All time",
              managerName: opp.name,
              analyticsPath: "h2h",
              priority: priority++,
            });
          }
        }
      }

      // --- 2. Scoring Stats ---
      const myScores: number[] = [];
      const allManagerScores = new Map<string, number[]>();

      for (const m of matchups) {
        if (m.homeScore === null || m.awayScore === null) continue;

        const homeScores = allManagerScores.get(m.homeManagerId) ?? [];
        homeScores.push(m.homeScore);
        allManagerScores.set(m.homeManagerId, homeScores);

        const awayScores = allManagerScores.get(m.awayManagerId) ?? [];
        awayScores.push(m.awayScore);
        allManagerScores.set(m.awayManagerId, awayScores);

        if (m.homeManagerId === manager.id) myScores.push(m.homeScore);
        if (m.awayManagerId === manager.id) myScores.push(m.awayScore);
      }

      // Consistency rank
      const avg = (arr: number[]) =>
        arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const stdDev = (arr: number[]) => {
        if (arr.length < 2) return 0;
        const mean = avg(arr);
        return Math.sqrt(
          arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (arr.length - 1)
        );
      };

      const managerConsistency: { id: string; sd: number }[] = [];
      for (const [mgrId, scores] of allManagerScores) {
        if (scores.length >= 10) {
          managerConsistency.push({ id: mgrId, sd: stdDev(scores) });
        }
      }
      managerConsistency.sort((a, b) => a.sd - b.sd);

      const consistencyRank = managerConsistency.findIndex((m) => m.id === manager.id);
      if (consistencyRank >= 0 && consistencyRank < 3) {
        const mySd = managerConsistency[consistencyRank].sd;
        insights.push({
          id: "consistency-rank",
          type: "consistency",
          headline: `Your scoring consistency is **#${consistencyRank + 1}** in the league`,
          detail: `Standard deviation of ${mySd.toFixed(1)}`,
          stat: `#${consistencyRank + 1}`,
          statLabel: "Consistency",
          managerName: null,
          analyticsPath: "scoring",
          priority: priority++,
        });
      }

      // --- 3. Clutch Rating ---
      const myRegScores: number[] = [];
      const myPlayoffScores: number[] = [];

      for (const m of matchups) {
        if (m.homeScore === null || m.awayScore === null) continue;
        const isPlayoff = m.matchupType === "PLAYOFF" || m.matchupType === "CHAMPIONSHIP";

        if (m.homeManagerId === manager.id) {
          (isPlayoff ? myPlayoffScores : myRegScores).push(m.homeScore);
        }
        if (m.awayManagerId === manager.id) {
          (isPlayoff ? myPlayoffScores : myRegScores).push(m.awayScore);
        }
      }

      if (myPlayoffScores.length >= 3) {
        const clutchRating = avg(myPlayoffScores) - avg(myRegScores);
        if (clutchRating > 3) {
          insights.push({
            id: "clutch-performer",
            type: "clutch",
            headline: `You score **+${clutchRating.toFixed(1)} PPG** more in the playoffs`,
            detail: `${myPlayoffScores.length} playoff games played`,
            stat: `+${clutchRating.toFixed(1)}`,
            statLabel: "Playoff boost",
            managerName: null,
            analyticsPath: "playoffs",
            priority: priority++,
          });
        }
      }

      // --- 4. Record Proximity ---
      const allIndividualScores: { score: number; managerId: string; week: number; year: number }[] = [];
      for (const m of matchups) {
        if (m.homeScore === null || m.awayScore === null) continue;
        allIndividualScores.push({
          score: m.homeScore,
          managerId: m.homeManagerId,
          week: m.week,
          year: m.season.year,
        });
        allIndividualScores.push({
          score: m.awayScore,
          managerId: m.awayManagerId,
          week: m.week,
          year: m.season.year,
        });
      }
      allIndividualScores.sort((a, b) => b.score - a.score);

      const myTopScore = allIndividualScores.find((s) => s.managerId === manager.id);
      if (myTopScore) {
        const rank = allIndividualScores.findIndex(
          (s) => s.score === myTopScore.score && s.managerId === myTopScore.managerId
        );
        if (rank < 5) {
          insights.push({
            id: "top-score-rank",
            type: "record",
            headline: `You hold the league's **#${rank + 1}** highest single-week score: **${myTopScore.score.toFixed(1)}**`,
            detail: `Week ${myTopScore.week}, ${myTopScore.year}`,
            stat: myTopScore.score.toFixed(1),
            statLabel: `#${rank + 1} all-time`,
            managerName: null,
            analyticsPath: "records",
            priority: priority++,
          });
        }
      }

      // --- 5. PPG Comparison ---
      if (myScores.length >= 10) {
        const myAvg = avg(myScores);
        const allScoresFlat = Array.from(allManagerScores.values()).flat();
        const leagueAvg = avg(allScoresFlat);
        const diff = myAvg - leagueAvg;

        if (Math.abs(diff) > 5) {
          insights.push({
            id: "ppg-comparison",
            type: "comparison",
            headline: `Your career PPG (**${myAvg.toFixed(1)}**) is **${diff > 0 ? "+" : ""}${diff.toFixed(1)}** ${diff > 0 ? "above" : "below"} the league average`,
            detail: `League avg: ${leagueAvg.toFixed(1)}`,
            stat: `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`,
            statLabel: "vs League",
            managerName: null,
            analyticsPath: "scoring",
            priority: priority++,
          });
        }
      }

      // --- 6. Heartbreak Count ---
      const myLosses: { margin: number; year: number; week: number }[] = [];
      for (const m of matchups) {
        if (m.homeScore === null || m.awayScore === null) continue;
        const isHome = m.homeManagerId === manager.id;
        const isAway = m.awayManagerId === manager.id;
        if (!isHome && !isAway) continue;

        const myScore = isHome ? m.homeScore : m.awayScore;
        const theirScore = isHome ? m.awayScore : m.homeScore;
        if (myScore < theirScore) {
          myLosses.push({
            margin: theirScore - myScore,
            year: m.season.year,
            week: m.week,
          });
        }
      }

      const closeLosses = myLosses.filter((l) => l.margin < 5);
      if (closeLosses.length >= 3) {
        insights.push({
          id: "heartbreak-losses",
          type: "heartbreak",
          headline: `**${closeLosses.length}** of your career losses were by less than **5 points**`,
          detail: "So close, yet so far",
          stat: `${closeLosses.length}`,
          statLabel: "Heartbreakers",
          managerName: null,
          analyticsPath: "records",
          priority: priority++,
        });
      }

      // --- 7. Career Milestone ---
      const totalGames = myScores.length;
      if (totalGames >= 50) {
        // Find rank among all managers by games played
        const gamesPerManager: { id: string; games: number }[] = [];
        for (const [mgrId, scores] of allManagerScores) {
          gamesPerManager.push({ id: mgrId, games: scores.length });
        }
        gamesPerManager.sort((a, b) => b.games - a.games);
        const gameRank = gamesPerManager.findIndex((m) => m.id === manager.id) + 1;

        insights.push({
          id: "career-milestone",
          type: "milestone",
          headline: `You've played **${totalGames} career matchups**`,
          detail: gameRank <= 3 ? `#${gameRank} most in league history` : null,
          stat: `${totalGames}`,
          statLabel: "Matchups",
          managerName: null,
          analyticsPath: "standings",
          priority: priority++,
        });
      }

      // Sort by priority and take top 8
      insights.sort((a, b) => a.priority - b.priority);
      const topInsights = insights.slice(0, 8);

      // Cache result
      insightCache.set(cacheKey, {
        data: topInsights,
        expires: Date.now() + CACHE_TTL_MS,
      });

      res.json({ insights: topInsights });
    } catch (err) {
      console.error("insights error:", err);
      res.status(500).json({ error: "Failed to generate insights" });
    }
  }
);

export default router;
