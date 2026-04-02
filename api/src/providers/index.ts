import type { ProviderAdapter } from "./types";
import { sleeperAdapter } from "./sleeper";
import { yahooAdapter } from "./yahoo";

const adapters: Record<string, ProviderAdapter> = {
  SLEEPER: sleeperAdapter,
  YAHOO: yahooAdapter,
};

export function getAdapter(provider: string): ProviderAdapter {
  const adapter = adapters[provider];
  if (!adapter) throw new Error(`No adapter for provider: ${provider}`);
  return adapter;
}

export type { ProviderAdapter, ProviderLeague, ProviderSeasonData } from "./types";
