import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getValidYahooToken } from "../lib/yahoo-tokens";
import { requireAuth } from "../middleware/auth";

const router = Router();

const YAHOO_AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
const YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

function getYahooConfig() {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;
  const redirectUri = process.env.YAHOO_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Yahoo OAuth not configured — set YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, YAHOO_REDIRECT_URI in .env");
  }
  return { clientId, clientSecret, redirectUri };
}

/**
 * GET /api/auth/yahoo — redirect the user to Yahoo's OAuth consent screen.
 * Pass ?userId=xxx to associate the tokens with a user after callback.
 */
router.get("/yahoo", (req, res) => {
  const { clientId, redirectUri } = getYahooConfig();
  const userId = req.query.userId as string | undefined;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "fspt-r", // Fantasy Sports read access
  });

  // Pass userId through state so we can associate tokens after callback
  if (userId) {
    params.set("state", userId);
  }

  res.redirect(`${YAHOO_AUTH_URL}?${params.toString()}`);
});

/**
 * GET /api/auth/yahoo/callback — Yahoo redirects here with ?code=xxx&state=userId
 * Exchange the code for access + refresh tokens, store in ProviderAccount.
 */
router.get("/yahoo/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;
  const errorDescription = req.query.error_description as string | undefined;
  const userId = req.query.state as string | undefined;

  if (error) {
    console.error("Yahoo OAuth error:", error, errorDescription);
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Yahoo Auth Failed</title></head>
      <body style="font-family: system-ui; text-align: center; padding: 4rem;">
        <h1 style="color: #F87171;">Yahoo Authorization Failed</h1>
        <p>${errorDescription || error}</p>
        <p style="color: #888;">You can close this window and try again in Fantasy Hub.</p>
      </body>
      </html>
    `);
    return;
  }

  if (!code) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Yahoo Auth Failed</title></head>
      <body style="font-family: system-ui; text-align: center; padding: 4rem;">
        <h1 style="color: #F87171;">Missing Authorization Code</h1>
        <p>Yahoo did not return an authorization code. Please try again.</p>
      </body>
      </html>
    `);
    return;
  }

  let clientId: string, clientSecret: string, redirectUri: string;
  try {
    ({ clientId, clientSecret, redirectUri } = getYahooConfig());
  } catch (err) {
    console.error("Yahoo OAuth config error:", err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Yahoo Auth Failed</title></head>
      <body style="font-family: system-ui; text-align: center; padding: 4rem;">
        <h1 style="color: #F87171;">Server Configuration Error</h1>
        <p>Yahoo OAuth is not configured on the server. Please contact support.</p>
      </body>
      </html>
    `);
    return;
  }

  try {
    // Exchange code for tokens
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch(YAHOO_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Yahoo token exchange failed:", tokenRes.status, errBody);
      res.status(502).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Yahoo Auth Failed</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 4rem;">
          <h1 style="color: #F87171;">Token Exchange Failed</h1>
          <p>Could not exchange authorization code for tokens. Please try again.</p>
          <p style="color: #888; font-size: 0.85rem;">Status: ${tokenRes.status}</p>
        </body>
        </html>
      `);
      return;
    }

    const tokens = (await tokenRes.json()) as Record<string, any>;
    const accessToken = tokens.access_token as string;
    const refreshToken = tokens.refresh_token as string;
    const expiresIn = tokens.expires_in as number;

    if (!accessToken || !refreshToken || !expiresIn) {
      console.error("Yahoo token response missing fields:", tokens);
      res.status(502).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Yahoo Auth Failed</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 4rem;">
          <h1 style="color: #F87171;">Invalid Token Response</h1>
          <p>Yahoo returned an incomplete token response. Please try again.</p>
        </body>
        </html>
      `);
      return;
    }

    // Yahoo may return the GUID as xoauth_yahoo_guid or token_type — use userId as fallback
    const yahooGuid = (tokens.xoauth_yahoo_guid ?? tokens.yahoo_guid ?? userId ?? "unknown") as string;

    const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    // If we have a userId (from state param), store the tokens
    // The state param contains the Clerk user ID — look up the DB user by clerkId
    if (userId) {
      const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
      });

      if (!dbUser) {
        console.error("Yahoo callback: no DB user found for clerkId:", userId);
        res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head><title>Yahoo Auth Failed</title></head>
          <body style="font-family: system-ui; text-align: center; padding: 4rem;">
            <h1 style="color: #F87171;">User Not Found</h1>
            <p>Could not find your account. Please sign in to Fantasy Hub first.</p>
          </body>
          </html>
        `);
        return;
      }

      await prisma.providerAccount.upsert({
        where: {
          provider_providerUserId: {
            provider: "YAHOO",
            providerUserId: yahooGuid,
          },
        },
        create: {
          userId: dbUser.id,
          provider: "YAHOO",
          providerUserId: yahooGuid,
          accessToken,
          refreshToken,
          tokenExpiry,
        },
        update: {
          accessToken,
          refreshToken,
          tokenExpiry,
          userId: dbUser.id,
        },
      });
    }

    // Return a success page (this is opened in a browser, not an API client)
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Yahoo Connected</title></head>
      <body style="font-family: system-ui; text-align: center; padding: 4rem;">
        <h1>Yahoo Fantasy Connected!</h1>
        <p>Your Yahoo account has been linked. You can close this window and return to Fantasy Hub.</p>
        <p style="color: #888; font-size: 0.85rem;">Yahoo ID: ${yahooGuid}</p>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Yahoo callback unexpected error:", err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Yahoo Auth Failed</title></head>
      <body style="font-family: system-ui; text-align: center; padding: 4rem;">
        <h1 style="color: #F87171;">Something Went Wrong</h1>
        <p>An unexpected error occurred during Yahoo authentication. Please try again.</p>
      </body>
      </html>
    `);
  }
});

/**
 * POST /api/auth/yahoo/refresh — refresh an expired Yahoo access token.
 * Body: { refreshToken: string } or uses stored token for the authenticated user.
 */
router.post("/yahoo/refresh", requireAuth, async (req, res) => {
  const user = (req as any).dbUser;
  const { clientId, clientSecret } = getYahooConfig();

  // Get refresh token from request body or stored provider account
  let refreshToken = req.body?.refreshToken as string | undefined;

  if (!refreshToken) {
    const account = await prisma.providerAccount.findFirst({
      where: { userId: user.id, provider: "YAHOO" },
    });
    if (!account?.refreshToken) {
      res.status(400).json({ error: "No Yahoo refresh token available" });
      return;
    }
    refreshToken = account.refreshToken;
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenRes = await fetch(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("Yahoo token refresh failed:", errBody);
    res.status(502).json({ error: "Failed to refresh Yahoo token" });
    return;
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  // Update stored tokens
  const account = await prisma.providerAccount.findFirst({
    where: { userId: user.id, provider: "YAHOO" },
  });

  if (account) {
    await prisma.providerAccount.update({
      where: { id: account.id },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry,
      },
    });
  }

  res.json({
    accessToken: tokens.access_token,
    expiresAt: tokenExpiry.toISOString(),
  });
});

/**
 * GET /api/auth/yahoo/status — check if the authenticated user has a connected Yahoo account.
 */
router.get("/yahoo/status", requireAuth, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const account = await prisma.providerAccount.findFirst({
      where: { userId: user.id, provider: "YAHOO" },
    });

    if (!account) {
      res.json({ connected: false });
      return;
    }

    const isExpired = account.tokenExpiry ? account.tokenExpiry < new Date() : false;
    res.json({
      connected: true,
      providerUserId: account.providerUserId,
      tokenExpired: isExpired,
    });
  } catch (err) {
    console.error("Yahoo status check error:", err);
    res.status(500).json({ error: "Failed to check Yahoo connection status" });
  }
});

export default router;
