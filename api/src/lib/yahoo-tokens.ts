import { prisma } from "./prisma";

const YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

/**
 * Get a valid Yahoo access token for a user, auto-refreshing if expired.
 * Returns the access token string, or null if no Yahoo account is connected.
 * Throws if refresh fails.
 */
export async function getValidYahooToken(userId: string): Promise<string | null> {
  const account = await prisma.providerAccount.findFirst({
    where: { userId, provider: "YAHOO" },
  });

  if (!account?.accessToken) return null;

  const isExpired = account.tokenExpiry ? account.tokenExpiry < new Date() : false;

  if (!isExpired) return account.accessToken;

  // Token is expired — attempt refresh
  if (!account.refreshToken) {
    throw new Error("Yahoo token expired and no refresh token available. Please reconnect Yahoo.");
  }

  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Yahoo OAuth not configured on server");
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
      refresh_token: account.refreshToken,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("Yahoo token auto-refresh failed:", errBody);
    throw new Error("Yahoo token expired and refresh failed. Please reconnect Yahoo from the app.");
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.providerAccount.update({
    where: { id: account.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry,
    },
  });

  console.log("Yahoo token auto-refreshed for user:", userId);
  return tokens.access_token;
}
