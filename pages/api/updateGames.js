import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    console.log("✅ Starting updateGames API");

    // Limit to 1 day to avoid timeout issues
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=${process.env.ODDS_API_KEY}&daysFrom=1`
    );

    if (response.status !== 200) {
      console.error("❌ Odds API fetch failed with status:", response.status);
      return res.status(500).json({ error: "Failed to fetch NCAA data" });
    }

    const gameData = await response.json();

    if (!Array.isArray(gameData)) {
      console.error("❌ Invalid API response format", gameData);
      return res.status(500).json({ error: "Invalid NCAA data" });
    }

    console.log(`✅ Fetched ${gameData.length} game records`);

    let successCount = 0;
    let skippedCount = 0;
    let failCount = 0;

    let gameTable = []; // Table to log the processed data

    // Process each game one by one
    for (const game of gameData) {
      if (!game.completed || !game.scores || game.scores.length !== 2) {
        console.log(`⏩ Skipping incomplete game: ${game.id}`, game);
        skippedCount++;
        continue;
      }

      const homeScore = game.scores?.find((score) => score.name === game.home_team)?.score;
      const awayScore = game.scores?.find((score) => score.name === game.away_team)?.score;

      // Ensure both scores are available
      if (homeScore === undefined || awayScore === undefined) {
        console.warn(`⚠️ Missing score data for game ${game.id}`, game);
        failCount++;
        continue;
      }

      const winner =
        parseInt(homeScore) > parseInt(awayScore) ? game.home_team : game.away_team;

      // Log game info for visibility
      gameTable.push({
        game_id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        home_score: homeScore,
        away_score: awayScore,
        winner: winner,
        tournament_day: game.tournament_day, // Assuming this field exists, or calculate it
      });

      // Map the winning team to internal team_id
      const { data: alias, error: aliasError } = await supabase
        .from("team_aliases")
        .select("team_id")
        .eq("alias_name", winner)
        .single();

      if (aliasError || !alias) {
        console.warn(`⚠️ No alias mapping found for: ${winner}`, aliasError);
        failCount++;
        continue;
      }

      const formattedUpdatedAt = new Date().toISOString().replace('T', ' ').split('.')[0];

      // Upsert game result into Supabase
      const { error: upsertError } = await supabase
        .from("games")
        .upsert(
          [
            {
              tournament_day: game.tournament_day,
              winning_api_team: winner,
              winning_team_id: alias.team_id,
              updated_at: formattedUpdatedAt,
            },
          ],
          { onConflict: "tournament_day,winning_api_team" }
        );

      if (upsertError) {
        console.error("❌ Upsert failed for", winner, upsertError);
        failCount++;
      } else {
        console.log(`✅ Successfully upserted: ${winner} on Day ${game.tournament_day}`);
        successCount++;
      }
    }

    // Log the table of game data for visibility
    console.log("📊 Games Data:");
    console.table(gameTable);

    console.log(`✅ Process complete - Success: ${successCount}, Skipped: ${skippedCount}, Failed: ${failCount}`);

    return res.status(200).json({ 
      message: "✅ Game results updated successfully", 
      successCount, 
      skippedCount, 
      failCount,
      gameTable, // Returning the game data table for reference
    });
  } catch (err) {
    console.error("❌ UpdateGames API failed:", err);
    return res.status(500).json({ error: "Failed to fetch or update game data" });
  }
}
