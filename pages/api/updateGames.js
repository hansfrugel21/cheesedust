// pages/api/updateGames.js
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Build the Odds API URL
const ODDS_API_URL = `https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=${process.env.ODDS_API_KEY}`;

export default async function handler(req, res) {
  console.log("Starting game update function...");
  console.log("ODDS API URL:", ODDS_API_URL);

  try {
    // Add Accept header for JSON
    const response = await fetch(ODDS_API_URL, {
      headers: { 'Accept': 'application/json' },
    });

    // Log the status
    console.log("Fetch response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch Odds API data: ${response.status} ${response.statusText} - ${errorText}`);
      return res.status(500).json({ error: "Failed to fetch NCAA data" });
    }

    const data = await response.json();
    console.log("Odds API Data received:", JSON.stringify(data, null, 2));

    // Validate API data format
    if (!Array.isArray(data)) {
      console.error("Invalid Odds API response format");
      return res.status(500).json({ error: "Invalid Odds API response format" });
    }

    // Loop through each game
    for (const game of data) {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      const homeScore = game.scores?.find(s => s.name === homeTeam)?.score;
      const awayScore = game.scores?.find(s => s.name === awayTeam)?.score;
      const status = game.completed ? "final" : "in_progress";

      console.log(`Processing game: ${homeTeam} vs ${awayTeam} | Status: ${status}`);

      // Upsert into the games table
      await supabase.from("games").upsert({
        game_id: game.id,
        home_team: homeTeam,
        away_team: awayTeam,
        home_score: homeScore,
        away_score: awayScore,
        status: status
      });

      // If the game is final, update elimination
      if (status === "final") {
        const loser = homeScore < awayScore ? homeTeam : awayTeam;
        console.log(`Game finished. Loser: ${loser}`);

        const loserRecord = await supabase.from("teams").select("id").eq("team_name", loser).single();

        if (loserRecord.data) {
          await supabase.from("teams").update({ eliminated: true }).eq("id", loserRecord.data.id);
          await supabase.from("picks").update({ eliminated: true }).eq("team_id", loserRecord.data.id);
          console.log(`Team ${loser} marked as eliminated along with related picks.`);
        } else {
          console.log(`Loser team ${loser} not found in database.`);
        }
      }
    }

    console.log("Game update complete");
    res.status(200).json({ message: "Update successful" });

  } catch (error) {
    console.error("Auto-update error:", error);
    res.status(500).json({ error: error.message });
  }
}
