import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // Example: Fetch API game results (replace with your API fetch logic)
    const apiResponse = await fetch(`https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores`, {
      headers: { 'Authorization': `Bearer ${process.env.ODDS_API_KEY}` }
    });

    const games = await apiResponse.json();

    // Loop through each game result from the API
    for (const game of games) {
      const apiWinner = game.winner_name;      // Adjust based on API structure
      const gameDay = determineGameDay(game);  // Your logic to map date to day number

      // ✅ Map API winner to your internal team_id
      const { data: aliasMatch } = await supabase
        .from('team_aliases')
        .select('team_id')
        .eq('alias_name', apiWinner)
        .single();

      if (!aliasMatch) {
        console.log(`No match found for API team: ${apiWinner}`);
        continue;
      }

      // ✅ Call the PostgreSQL function to upsert
      await supabase.rpc('upsert_game_result', {
        p_day: gameDay,
        p_api_team_name: apiWinner,
        p_team_id: aliasMatch.team_id
      });
    }

    return res.status(200).json({ message: 'Games updated successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update games' });
  }
}

function determineGameDay(game) {
  // Write logic to map game.date to your tournament_day (1, 2, 3, etc.)
  return 1; // Example placeholder
}
