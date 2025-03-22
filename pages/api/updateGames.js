import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const oddsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=${process.env.ODDS_API_KEY}`
    );
    const games = await oddsRes.json();

    if (!Array.isArray(games)) throw new Error("Invalid NCAA data");

    for (const game of games) {
      const winner =
        game.completed && game.home_team_score !== null && game.away_team_score !== null
          ? game.home_team_score > game.away_team_score
            ? game.home_team
            : game.away_team
          : null;

      if (!winner) continue;

      const { data: alias } = await supabase
        .from("team_aliases")
        .select("team_id")
        .eq("alias_name", winner)
        .single();

      if (!alias) {
        console.log(`No alias mapping found for: ${winner}`);
        continue;
      }

      // Upsert into games table
      await supabase.from("games").upsert(
        {
          tournament_day: 1, // Adjust if needed
          winning_api_team: winner,
          winning_team_id: alias.team_id,
          start_time: game.commence_time,
        },
        { onConflict: "winning_api_team" }
      );
    }

    res.status(200).json({ message: "Games table updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update games table" });
  }
}
