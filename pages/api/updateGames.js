import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to handle upsert batch
async function batchUpsertGames(upsertData) {
  if (upsertData.length === 0) return;
  const { error } = await supabase
    .from("games")
    .upsert(upsertData, { onConflict: "tournament_day,winning_api_team" });
  return error;
}

export default async function handler(req, res) {
  try {
    console.log("✅ Starting updateGames API");

    // Fetch NCAA basketball scores from Odds API
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=${process.env.ODDS_API_KEY}&daysFrom=3`
    );

    if (response.status !== 200) {
      console.error("❌ Odds API fetch failed with status:", response.status);
      return res.status(500).json({ error: "Failed to fetch NCAA data" });
    }

    const gameData = await response.json();

    // Ensure we have valid API data
    if (!Array.isArray(gameData)) {
      console.error("❌ Invalid API response format", gameData);
      return res.status(500).json({ error: "Invalid NCAA data" });
    }

    console.log(`✅ Fetched ${gameData.length} game records`);

    let successCount = 0;
    let skippedCount = 0;
    let failCount = 0;

    const batchSize = 5; // Set batch size to process fewer records at a time
    const upsertBatch = [];

    // Process each game record
    for (let i = 0; i < gameData.length; i++) {
      const game = gameData[i];

      if (!game.completed || !game.scores || game.scores.length !== 2) {
        console.log(`⏩ Skipping incomplete game: ${game.id}`, game);
        skippedCount++;
        continue;
      }

      const homeScore = game.scores.find((score) => score.name === game.home_team)?.score;
      const awayScore = game.scores.find((score) => score.name === game.away_team)?.score;

      // If scores are missing, skip the game
      if (homeScore === undefined || awayScore === undefined) {
        console.warn(`⚠️ Missing score data for game ${game.id}`, game);
        failCount++;
        continue;
      }

      // Determine the winner of the game
      const winner = parseInt(homeScore) > parseInt(awayScore) ? game.home_team : game.away_team;
      console.log(`🏀 Game complete. Winner determined: ${winner}`);

      // Fetch internal team_id using team alias
      const { data: homeAlias, error: homeAliasError } = await supabase
        .from("team_aliases")
        .select("team_id")
        .eq("alias_name", game.home_team)
        .single();

      const { data: awayAlias, error: awayAliasError } = await supabase
        .from("team_aliases")
        .select("team_id")
        .eq("alias_name", game.away_team)
        .single();

      if (homeAliasError || awayAliasError || !homeAlias || !awayAlias) {
        console.warn(`⚠️ No alias mapping found for teams: ${game.home_team}, ${game.away_team}`);
        failCount++;
        continue;
      }

      // Determine tournament day based on the game start time
      const gameDate = new Date(game.commence_time);
      let tournament_day = 1;
      if (gameDate >= new Date("2025-03-21T00:00:00Z")) tournament_day = 2;
      if (gameDate >= new Date("2025-03-22T00:00:00Z")) tournament_day = 3;

      // Format the updated time
      const formattedUpdatedAt = new Date().toISOString().replace('T', ' ').split('.')[0];

      upsertBatch.push({
        tournament_day,
        winning_api_team: winner,
        winning_team_id: winner === game.home_team ? homeAlias.team_id : awayAlias.team_id,
        updated_at: formattedUpdatedAt,
      });

      // Process batch when batch size is reached
      if (upsertBatch.length >= batchSize) {
        const error = await batchUpsertGames(upsertBatch);
        if (error) {
          console.error("❌ Error during batch upsert", error);
          failCount++;
        } else {
          console.log(`✅ Batch of ${upsertBatch.length} games successfully upserted`);
          successCount += upsertBatch.length;
        }
        upsertBatch.length = 0; // Clear the batch
      }
    }

    // Final batch processing if any records are left
    if (upsertBatch.length > 0) {
      const error = await batchUpsertGames(upsertBatch);
      if (error) {
        console.error("❌ Error during final batch upsert", error);
        failCount++;
      } else {
        console.log(`✅ Final batch of ${upsertBatch.length} games successfully upserted`);
        successCount += upsertBatch.length;
      }
    }

    // Return response with counts and game data table
    console.log(`✅ Process complete - Success: ${successCount}, Skipped: ${skippedCount}, Failed: ${failCount}`);

    return res.status(200).json({
      message: "✅ Game results updated successfully",
      successCount,
      skippedCount,
      failCount,
      gameTable: gameData.map((game) => ({
        game_id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        home_score: game.scores[0]?.score,
        away_score: game.scores[1]?.score,
        winner: winner,
      })),
    });
  } catch (err) {
    console.error("❌ UpdateGames API failed:", err);
    return res.status(500).json({ error: "Failed to fetch or update game data" });
  }
}
