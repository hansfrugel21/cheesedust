// Supabase Edge Function or Next.js API Route to auto-update games and eliminate users

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const NCAA_JSON_URL = "https://data.ncaa.com/casablanca/game-center/basketball-men/d1/{DATE}/scoreboard.json";

export default async function handler(req, res) {
  try {
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const fetchUrl = NCAA_JSON_URL.replace("{DATE}", date);
    const response = await fetch(fetchUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch NCAA data: ${response.status} ${response.statusText} - ${errorText}`);
      return res.status(500).json({ error: "Failed to fetch NCAA data" });
    }

    const data = await response.json();
    console.log("NCAA API Response:", JSON.stringify(data, null, 2));

    // ✅ Corrected: NCAA response has "games" at the root level
    if (!data?.games || !Array.isArray(data.games)) {
      console.error("No games array found in API response");
      return res.status(500).json({ error: "Invalid NCAA API response format" });
    }

    for (const game of data.games) {
      const homeTeam = game.home;
      const awayTeam = game.away;
      const winner = homeTeam.winner ? homeTeam.names.short : awayTeam.winner ? awayTeam.names.short : null;
      const loser = homeTeam.winner ? awayTeam.names.short : awayTeam.winner ? homeTeam.names.short : null;

      // Upsert game result into the DB
      await supabase.from("games").upsert({
        game_id: game.id,
        home_team: homeTeam.names.short,
        away_team: awayTeam.names.short,
        home_score: homeTeam.score,
        away_score: awayTeam.score,
        status: game.status.type.name
      });

      // If finished, mark loser eliminated
      if (game.status.type.name === "final" && loser) {
        const loserRecord = await supabase.from("teams").select("id").eq("team_name", loser).single();
        if (loserRecord.data) {
          await supabase.from("teams").update({ eliminated: true }).eq("id", loserRecord.data.id);

          // Eliminate users who picked the losing team
          await supabase.from("picks").update({ eliminated: true }).eq("team_id", loserRecord.data.id);
        }
      }
    }

    res.status(200).json({ message: "Update successful" });
  } catch (error) {
    console.error("Auto-update error:", error);
    res.status(500).json({ error: error.message });
  }
}
