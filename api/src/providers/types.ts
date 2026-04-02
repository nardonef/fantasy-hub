/** Shared types for provider adapters */

export interface ProviderLeague {
  providerLeagueId: string;
  name: string;
  scoringType: string | null;
  teamCount: number;
  seasons: number[]; // years available
  /** Yahoo-specific: maps year → league_key since each season has a different key */
  seasonLeagueIds?: Record<number, string>;
}

export interface ProviderManager {
  providerManagerId: string;
  name: string;
  avatarUrl: string | null;
  teamName: string;
  /** Original numeric slot ID (Yahoo manager_id). Used for intra-season cross-referencing. */
  originalSlotId?: string;
}

export interface ProviderMatchup {
  week: number;
  matchupType: "REGULAR" | "PLAYOFF" | "CONSOLATION" | "CHAMPIONSHIP";
  homeManagerId: string;
  awayManagerId: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface ProviderDraftPick {
  round: number;
  pickNumber: number;
  managerProviderManagerId: string;
  playerName: string;
  position: string | null;
}

export interface ProviderTransaction {
  type: "ADD" | "DROP" | "TRADE" | "WAIVER";
  managerProviderManagerId: string;
  playerName: string;
  week: number | null;
  transactionDate: Date | null;
}

export interface ProviderSeasonData {
  year: number;
  managers: ProviderManager[];
  matchups: ProviderMatchup[];
  draftPicks: ProviderDraftPick[];
  transactions: ProviderTransaction[];
  standings: {
    managerProviderManagerId: string;
    rank: number;
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
    pointsAgainst: number;
  }[];
  championManagerId: string | null;
}

/**
 * Provider adapter interface — each provider (Yahoo, ESPN, Sleeper)
 * implements this to normalize their API data into shared types.
 */
export interface ProviderAdapter {
  /** Fetch all leagues for the authenticated user */
  getLeagues(credentials: Record<string, string>): Promise<ProviderLeague[]>;

  /** Fetch full season data for a specific league and year */
  getSeasonData(
    credentials: Record<string, string>,
    leagueId: string,
    year: number
  ): Promise<ProviderSeasonData>;
}
