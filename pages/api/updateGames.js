// ✅ Refactored /pages/api/updateGames.js with better error handling, alias mapping check, dynamic tournament day, and logging

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=${process.env.ODDS_API_KEY}&daysFrom=3`
    );

    if (response.status !== 200) {
      console.error("Odds API fetch failed with status:", response.status);
      return res.status(500).json({ error: "Failed to fetch NCAA data" });
    }

    const gameData = await response.json();

    if (!Array.isArray(gameData)) {
      console.error("Invalid API response format", gameData);
      return res.status(500).json({ error: "Invalid NCAA data" });
    }

    console.log("Fetched game records:", gameData.length);

    for (const game of gameData) {
      if (!game.completed || !game.scores) continue;

      const winner =
        game.scores.home.score > game.scores.away.score
          ? game.home_team
          : game.away_team;

      console.log(`Evaluating winner: ${winner}`);

      // Map API team name to internal team_id
      const { data: alias, error: aliasError } = await supabase
        .from("team_aliases")
        .select("team_id")
        .eq("alias_name", winner)
        .single();

      if (aliasError || !alias) {
        console.warn(`No alias mapping found for: ${winner}`, aliasError);
        continue;
      }

      // Assign tournament day based on game date
      const gameDate = new Date(game.commence_time);
      let tournament_day = 1;
      if (gameDate >= new Date("2025-03-21T00:00:00Z")) tournament_day = 2;
      if (gameDate >= new Date("2025-03-22T00:00:00Z")) tournament_day = 3;

      // Upsert the winning team into games table
      const { error: upsertError } = await supabase
        .from("games")
        .upsert(
          [
            {
              tournament_day,
              winning_api_team: winner,
              winning_team_id: alias.team_id,
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "tournament_day,winning_api_team" }
        );

      if (upsertError) {
        console.error("Upsert failed for", winner, upsertError);
      } else {
        console.log(`✅ Upserted: ${winner} on Day ${tournament_day}`);
      }
    }

    return res.status(200).json({ message: "✅ Game results updated successfully" });
  } catch (err) {
    console.error("UpdateGames API failed:", err);
    return res.status(500).json({ error: "Failed to fetch or update game data" });
  }
}
