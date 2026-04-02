import Foundation

struct Superlative: Identifiable {
    let id: String
    let title: String
    let icon: String
    let stat: String
    let detail: String
}

struct SuperlativeEngine {
    static func compute(
        myManagerId: String,
        scoring: [ScoringData],
        extremes: ExtremesResponse,
        playoffs: [PlayoffPerformance],
        records: RecordsResponse,
        h2h: H2HResponse,
        standings: [StandingsEntry]
    ) -> [Superlative] {
        var results: [Superlative] = []

        let myScoring = scoring.first { $0.managerId == myManagerId }

        // Collect all team names the user has used across seasons
        let myTeamNames: Set<String> = Set(
            standings.filter { $0.managerId == myManagerId }.map { $0.teamName }
        )
        let myManagerName = standings.first { $0.managerId == myManagerId }?.manager.name ?? ""

        // --- The Sniper (lowest consistency / stddev, top 2) ---
        let sortedByConsistency = scoring
            .filter { $0.gamesPlayed >= 10 }
            .sorted { $0.consistency < $1.consistency }
        if let myRank = sortedByConsistency.firstIndex(where: { $0.managerId == myManagerId }),
           myRank < 2, let myData = myScoring {
            results.append(Superlative(
                id: "sniper",
                title: "The Sniper",
                icon: "scope",
                stat: String(format: "σ = %.1f", myData.consistency),
                detail: "#\(myRank + 1) most consistent"
            ))
        }

        // --- Boom or Bust (highest consistency / stddev, top 2) ---
        let sortedByVariance = scoring
            .filter { $0.gamesPlayed >= 10 }
            .sorted { $0.consistency > $1.consistency }
        if let myRank = sortedByVariance.firstIndex(where: { $0.managerId == myManagerId }),
           myRank < 2, let myData = myScoring {
            results.append(Superlative(
                id: "boom-or-bust",
                title: "Boom or Bust",
                icon: "waveform.path",
                stat: String(format: "σ = %.1f", myData.consistency),
                detail: "Highest variance"
            ))
        }

        // --- Playoff Machine (made playoffs >= 60% of seasons) ---
        let mySeasons = standings.filter { $0.managerId == myManagerId }
        let playoffSeasons = mySeasons.filter { $0.madePlayoffs }
        if mySeasons.count >= 3 {
            let playoffRate = Double(playoffSeasons.count) / Double(mySeasons.count)
            if playoffRate >= 0.6 {
                results.append(Superlative(
                    id: "playoff-machine",
                    title: "Playoff Machine",
                    icon: "flame.fill",
                    stat: String(format: "%.0f%%", playoffRate * 100),
                    detail: "\(playoffSeasons.count)/\(mySeasons.count) seasons"
                ))
            }
        }

        // --- Dynasty Builder (multiple championships) ---
        let myChampionships = records.champions.filter { name in
            myTeamNames.contains(name.manager) || name.manager == myManagerName
        }
        if myChampionships.count >= 2 {
            let years = myChampionships.map { "\($0.year)" }.joined(separator: ", ")
            results.append(Superlative(
                id: "dynasty",
                title: "Dynasty Builder",
                icon: "trophy.fill",
                stat: "\(myChampionships.count) titles",
                detail: years
            ))
        }

        // --- Clutch Gene (positive clutch rating, top 3) ---
        let sortedClutch = playoffs.sorted { $0.clutchRating > $1.clutchRating }
        if let myRank = sortedClutch.firstIndex(where: { $0.managerId == myManagerId }),
           myRank < 3 {
            let myClutch = sortedClutch[myRank]
            if myClutch.clutchRating > 0 {
                results.append(Superlative(
                    id: "clutch",
                    title: "Clutch Gene",
                    icon: "bolt.fill",
                    stat: String(format: "+%.1f", myClutch.clutchRating),
                    detail: "Playoff PPG boost"
                ))
            }
        }

        // --- Rival Slayer (70%+ win rate vs any manager with 6+ matchups) ---
        let myH2H = h2h.records.filter { $0.managerId == myManagerId }
        for record in myH2H {
            let total = record.wins + record.losses
            guard total >= 6 else { continue }
            let winPct = Double(record.wins) / Double(total)
            if winPct >= 0.7 {
                let opponentName = h2h.managers.first { $0.id == record.opponentId }?.name ?? "opponent"
                results.append(Superlative(
                    id: "rival-slayer",
                    title: "Rival Slayer",
                    icon: "person.fill.xmark",
                    stat: "\(record.wins)-\(record.losses)",
                    detail: "vs \(opponentName)"
                ))
                break // Only show one
            }
        }

        // --- Heartbreak Kid (most losses by < 5 points) ---
        let matchNames = myTeamNames.union([myManagerName])
        let heartbreaks = extremes.closestGames.filter { game in
            matchNames.contains(game.loser) && game.margin < 5
        }
        if heartbreaks.count >= 2 {
            results.append(Superlative(
                id: "heartbreak",
                title: "Heartbreak Kid",
                icon: "heart.slash.fill",
                stat: "\(heartbreaks.count)",
                detail: "Losses by < 5 pts"
            ))
        }

        // --- Blowout Artist (appears 3+ times in top 10 blowout wins) ---
        let blowoutWins = extremes.biggestBlowouts.prefix(10).filter { game in
            matchNames.contains(game.winner)
        }
        if blowoutWins.count >= 3 {
            results.append(Superlative(
                id: "blowout-artist",
                title: "Blowout Artist",
                icon: "bolt.horizontal.fill",
                stat: "\(blowoutWins.count)x",
                detail: "Top 10 blowouts"
            ))
        }

        // --- Iron Man (most consecutive seasons played) ---
        if mySeasons.count >= 5 {
            results.append(Superlative(
                id: "iron-man",
                title: "Iron Man",
                icon: "figure.walk",
                stat: "\(mySeasons.count)",
                detail: "Seasons played"
            ))
        }

        return results
    }
}
