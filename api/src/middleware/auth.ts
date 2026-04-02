import { clerkMiddleware, getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

const DEV_MODE = process.env.NODE_ENV === "development" && process.env.CLERK_SECRET_KEY?.includes("PLACEHOLDER");

export { clerkMiddleware };

/** Require authentication and attach the database user to req */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Dev bypass: auto-create/use a dev user when Clerk isn't configured
  if (DEV_MODE) {
    let user = await prisma.user.findUnique({
      where: { clerkId: "dev_user" },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId: "dev_user",
          email: "dev@fantasyhub.local",
          name: "Dev User",
        },
      });
    }
    (req as any).dbUser = user;
    return next();
  }

  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Find or create user in our database
  let user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId: auth.userId,
        email: `${auth.userId}@placeholder.com`, // Will be updated from Clerk webhook
      },
    });
  }

  (req as any).dbUser = user;
  next();
}

/** Require membership in a specific league */
export async function requireLeagueMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = (req as any).dbUser;
  const leagueId = req.params.leagueId;

  if (!user || !leagueId) {
    res.status(400).json({ error: "Missing user or league ID" });
    return;
  }

  let membership = await prisma.leagueMember.findUnique({
    where: {
      userId_leagueId: { userId: user.id, leagueId },
    },
  });

  if (!membership) {
    res.status(403).json({ error: "Not a member of this league" });
    return;
  }

  (req as any).leagueMembership = membership;
  next();
}
