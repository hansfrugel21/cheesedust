import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    console.log("Fetching NCAA game results from Odds API...");

    const oddsResponse = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=${process.env.ODDS_API_KEY}`);
    if (!oddsResponse.ok) throw new Error("Failed to fetch from Odds API");
    const games = await oddsResponse.json();

    if (!Array.isArray(games) || games.length === 0) {
      console.log("No games data returned from API.");
      return res.status(200).json({ message: "No new games to process." });
    }

    for (const game of games) {
      const apiWinner = game.winner;
      const gameDay = mapGameDateToDay(game.commence_time);
      if (!apiWinner || !gameDay) continue;

      const { data: alias, error: aliasError } = await supabase
        .from('team_aliases')
        .select('team_id')
        .eq('alias_name', apiWinner)
        .single();

      if (aliasError || !alias) continue;

      const { error: rpcError } = await supabase.rpc('upsert_game_result', {
        p_day: gameDay,
        p_api_team_name: apiWinner,
        p_team_id: alias.team_id,
      });
      if (rpcError) console.error(`RPC error for ${apiWinner}:`, rpcError);
    }

    res.status(200).json({ message: "Game results processed successfully." });
  } catch (err) {
    console.error("UpdateGames API Error:", err);
    res.status(500).json({ error: "Failed to update games" });
  }
}

function mapGameDateToDay(dateStr) {
  const date = new Date(dateStr);
  if (date.toISOString().startsWith("2025-03-20")) return 1;
  if (date.toISOString().startsWith("2025-03-21")) return 2;
  if (date.toISOString().startsWith("2025-03-22")) return 3;
  return null;
}
