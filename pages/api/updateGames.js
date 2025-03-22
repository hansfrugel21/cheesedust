import { createClient } from "@supabase/supabase-js";

// ✅ Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    console.log("Fetching NCAA game results from Odds API...");

    // ✅ Fetch results from Odds API (replace the URL with your working endpoint)
    const oddsResponse = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=${process.env.ODDS_API_KEY}`);
    if (!oddsResponse.ok) throw new Error("Failed to fetch from Odds API");
    const games = await oddsResponse.json();

    if (!Array.isArray(games) || games.length === 0) {
      console.log("No games data returned from API.");
      return res.status(200).json({ message: "No new games to process." });
    }

    for (const game of games) {
      const apiWinner = game.winner; // ✅ Adjust this based on your API response structure
      const gameDay = mapGameDateToDay(game.commence_time); // Replace with your logic

      if (!apiWinner || !gameDay) {
        console.log(`Skipping incomplete game record:`, game);
        continue;
      }

      // ✅ Find matching internal team_id using team_aliases
      const { data: alias, error: aliasError } = await supabase
        .from('team_aliases')
        .select('team_id')
        .eq('alias_name', apiWinner)
        .single();

      if (aliasError || !alias) {
        console.warn(`Alias not found for API team "${apiWinner}". Skipping.`);
        continue;
      }

      console.log(`Upserting result: Day ${gameDay} Winner: ${apiWinner}`);

      // ✅ Call your stored procedure to upsert the result
      const { error: rpcError } = await supabase.rpc('upsert_game_result', {
        p_day: gameDay,
        p_api_team_name: apiWinner,
        p_team_id: alias.team_id,
      });

      if (rpcError) {
        console.error(`RPC error for ${apiWinner}:`, rpcError);
      }
    }

    res.status(200).json({ message: "Game results processed successfully." });
  } catch (err)
