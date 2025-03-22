import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  console.log("✅ Starting updateGames API");

  // DEBUG: Validate environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ODDS_API_KEY) {
    console.error("❌ Missing environment variables");
    return res.status(500).json({ error: "Missing environment variables" });
  }

  try {
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_ncaab/scores/?apiKey=${process.env.ODDS_API_KEY}&daysFrom=3`
    );

    if (!response.ok) {
      console.error("❌ Odds API fetch failed with status:", response.status);
      return res.status(500).json({ error: "Failed to fetch NCAA data" });
    }

    const gameData = await response.json();

    if (!Array.isArray(gameData)) {
      console.error("❌ Invalid API response format", gameData);
      return res.status(500).json({ error: "Invalid NCAA data format" });
    }

    console.log(`✅ Fetched ${gameData.length} game records`);

    let successCount = 0;
    let skippedCount = 0;
    let failCount = 0;

    for (const game of gameData) {
      if (!game.completed || !game.scores) {
        console.log(`⏩ Skipping incomplete game: ${game.id}`);
        skippedCount++;
        continue;
      }

      const winner =
        game.scores.home.score > game.scores.away.score
          ? game.home_team
          : game.away_team;

      console.log(`🏀 Game complete. Winner: ${winner}`);

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

      const gameDate = new Date(game.commence_time);
      let tournament_day = 1;
      if (gameDate >= new Date("2025-03-21T00:00:00Z")) tournament_day = 2;
      if (gameDate >= new Date("2025-03-22T00:00:00Z")) tournament_day = 3;

      console.log("📥 Attempting Upsert:", {
        tournament_day,
        winning_api_team: winner,
        winning_team_id: alias.team_id,
      });

      const { error: upsertError } = await supabase
        .from("games")
        .upsert(
          [
            {
              tournament_day,
              winning_api_team: winner,
              winning_team_id: alias.team_id,
              updated_at: new Date().toISOString().replace('T', ' ').split('.')[0],
            },
          ],
          { onConflict: "tournament_day,winning_api_team" }
        );

      if (upsertError) {
        console.error(`❌ Upsert failed for ${winner}:`, upsertError);
        failCount++;
      } else {
        console.log(`✅ Upsert success: ${winner} on Day ${tournament_day}`);
        successCount++;
      }
    }

    console.log(`✅ Update Complete - Success: ${successCount}, Skipped: ${skippedCount}, Failed: ${failCount}`);

    return res.status(200).json({
      message: "✅ Game results updated successfully",
      successCount,
      skippedCount,
      failCount
    });

  } catch (err) {
    console.error("❌ Caught Exception:", err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
