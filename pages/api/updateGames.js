import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  try {
    const oddsRes = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=${process.env.ODDS_API_KEY}`);
    const games = await oddsRes.json();

    if (!games || !Array.isArray(games)) throw new Error('Failed to fetch NCAA data');

    for (const game of games) {
      // ✅ Adjust based on your Odds API structure
      const winner = game.completed ? game.home_team_score > game.away_team_score ? game.home_team : game.away_team : null;
      const startTime = game.commence_time;
      const dayNumber = 1; // 🔄 Update this logic if you map dates to tournament days

      if (!winner) continue;

      // ✅ Map API winner name to your database's team_id
      const { data: alias } = await supabase
        .from("team_aliases")
        .select("team_id")
        .eq("alias_name", winner)
        .single();

      if (!alias) {
        console.log(`No alias match found for ${winner}`);
        continue;
      }

      await supabase
        .from("games")
        .upsert({
          tournament_day: dayNumber,
          winning_api_team: winner,
          winning_team_id: alias.team_id,
          start_time: startTime
        }, { onConflict: 'winning_api_team' });
    }

    res.status(200).json({ message: "Games updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch NCAA data" });
  }
}
