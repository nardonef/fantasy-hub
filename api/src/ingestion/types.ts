import type { SignalSource, SignalType } from "../generated/prisma/client";

export type { SignalSource, SignalType };

/**
 * A single signal returned by an ingestion adapter before it's persisted.
 * `rawPlayerName` is resolved to a Player record by the player resolution
 * pipeline. If resolution fails, the signal is dropped (not persisted).
 */
export interface RawSignal {
  rawPlayerName: string;
  source: SignalSource;
  signalType: SignalType;
  content: string;
  metadata?: Record<string, unknown>;
  publishedAt: Date;
}

/**
 * Contract every ingestion adapter must implement.
 */
export interface IngestionAdapter {
  source: SignalSource;
  /** Fetch the latest signals. Each adapter is responsible for deduplication
   *  against its own source (e.g. checking Reddit post IDs in metadata). */
  fetchSignals(): Promise<RawSignal[]>;
}
