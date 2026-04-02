-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('YAHOO', 'ESPN', 'SLEEPER');

-- CreateEnum
CREATE TYPE "LeagueRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('IMPORTING', 'IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "MatchupType" AS ENUM ('REGULAR', 'PLAYOFF', 'CONSOLATION', 'CHAMPIONSHIP');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('ADD', 'DROP', 'TRADE', 'WAIVER');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expiry" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "provider_league_id" TEXT NOT NULL,
    "sport_type" TEXT NOT NULL DEFAULT 'nfl',
    "scoring_type" TEXT,
    "team_count" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "role" "LeagueRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managers" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "provider_manager_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "provider_season_id" TEXT,
    "status" "SeasonStatus" NOT NULL DEFAULT 'IMPORTED',
    "champion_manager_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_managers" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,
    "final_rank" INTEGER,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "ties" INTEGER NOT NULL DEFAULT 0,
    "points_for" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "points_against" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "made_playoffs" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "season_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matchups" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "matchup_type" "MatchupType" NOT NULL DEFAULT 'REGULAR',
    "home_manager_id" TEXT NOT NULL,
    "away_manager_id" TEXT NOT NULL,
    "home_score" DOUBLE PRECISION,
    "away_score" DOUBLE PRECISION,
    "metadata" JSONB,

    CONSTRAINT "matchups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standings" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "ties" INTEGER NOT NULL DEFAULT 0,
    "points_for" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "points_against" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "standings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_picks" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "pick_number" INTEGER NOT NULL,
    "player_name" TEXT NOT NULL,
    "position" TEXT,
    "metadata" JSONB,

    CONSTRAINT "draft_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "player_name" TEXT NOT NULL,
    "week" INTEGER,
    "transaction_date" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "job_type" TEXT NOT NULL,
    "sync_mode" TEXT NOT NULL DEFAULT 'full',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total_items" INTEGER,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "provider_accounts_provider_provider_user_id_key" ON "provider_accounts"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_provider_provider_league_id_key" ON "leagues"("provider", "provider_league_id");

-- CreateIndex
CREATE UNIQUE INDEX "league_members_user_id_league_id_key" ON "league_members"("user_id", "league_id");

-- CreateIndex
CREATE UNIQUE INDEX "managers_league_id_provider_manager_id_key" ON "managers"("league_id", "provider_manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_league_id_year_key" ON "seasons"("league_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "season_managers_season_id_manager_id_key" ON "season_managers"("season_id", "manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "matchups_season_id_week_home_manager_id_away_manager_id_key" ON "matchups"("season_id", "week", "home_manager_id", "away_manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "standings_season_id_manager_id_week_key" ON "standings"("season_id", "manager_id", "week");

-- CreateIndex
CREATE UNIQUE INDEX "draft_picks_season_id_round_pick_number_key" ON "draft_picks"("season_id", "round", "pick_number");

-- AddForeignKey
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managers" ADD CONSTRAINT "managers_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_managers" ADD CONSTRAINT "season_managers_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_managers" ADD CONSTRAINT "season_managers_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_home_manager_id_fkey" FOREIGN KEY ("home_manager_id") REFERENCES "managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_away_manager_id_fkey" FOREIGN KEY ("away_manager_id") REFERENCES "managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standings" ADD CONSTRAINT "standings_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
