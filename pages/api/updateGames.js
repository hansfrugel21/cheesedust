// ✅ Updated /pages/api/updateGames.js with debugging and gameData response

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const response = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=${process.env.ODDS_API_KEY}`);

    if (!response.ok) {
      console.error("Failed to fetch NCAA data");
      return res.status(500).json({ error: "Failed to fetch NCAA data" });
    }

    const gameData = await response.json();

    for (const game of gameData) {
      const apiWinner = game.scores?.home?.score > game.scores?.away?.score ? game.home_team : game.away_team;

      // Map API winner name to database team_id
      const { data: alias, error: aliasError } = await supabase
        .from("team_aliases")
        .select("team_id")
        .eq("alias_name", apiWinner)
        .single();

      if (aliasError || !alias) {
        console.error(`Alias not found for ${apiWinner}`);
        continue;
      }

      // Example: You might want to use a date-to-day mapping logic if needed
      const tournamentDay = 1; // Adjust logic here if needed

      // Upsert game result
      const { error: upsertError } = await supabase
        .from("games")
        .upsert({
          tournament_day: tournamentDay,
          winning_api_team: apiWinner,
          winning_team_id: alias.team_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tournament_day,winning_api_team" });

      if (upsertError) {
        console.error("Failed to upsert game:", upsertError);
      }
    }

    return res.status(200).json({ message: "Games updated successfully", gameData });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
