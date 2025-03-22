import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    // Hardcoded missing teams and their team_ids
    const missingTeams = {
      "American Eagles": "some-team-id-1",  // Replace with actual team ID
      "Mt. St. Mary's Mountaineers": "some-team-id-2",  // Replace with actual team ID
      "Saint Joseph's Hawks": "some-team-id-3",  // Replace with actual team ID
      "UAB Blazers": "some-team-id-4",  // Replace with actual team ID
      "George Mason Patriots": "some-team-id-5",  // Replace with actual team ID
      "Samford Bulldogs": "some-team-id-6",  // Replace with actual team ID
      "Dayton Flyers": "some-team-id-7",  // Replace with actual team ID
      "Florida Atlantic Owls": "some-team-id-8",  // Replace with actual team ID
      "North Texas Mean Green": "some-team-id-9",  // Replace with actual team ID
      "Furman Paladins": "some-team-id-10",  // Replace with actual team ID
      "Bradley Braves": "some-team-id-11",  // Replace with actual team ID
      "North Alabama Lions": "some-team-id-12",  // Replace with actual team ID
      "SMU Mustangs": "some-team-id-13",  // Replace with actual team ID
      "Northern Iowa Panthers": "some-team-id-14",  // Replace with actual team ID
      "Xavier Musketeers": "some-team-id-15",  // Replace with actual team ID
      "UC Irvine Anteaters": "some-team-id-16",  // Replace with actual team ID
      "N Colorado Bears": "some-team-id-17",  // Replace with actual team ID
      "San José St Spartans": "some-team-id-18",  // Replace with actual team ID
      "Loyola (Chi) Ramblers": "some-team-id-19",  // Replace with actual team ID
      "San Francisco Dons": "some-team-id-20",  // Replace with actual team ID
      "Utah Valley Wolverines": "some-team-id-21"  // Replace with actual team ID
    };

    // Function to fetch team ID from alias, teams table, or the hardcoded list
    async function getTeamId(teamName) {
      // Check the missing teams list first
      if (missingTeams[teamName]) {
        console.log(`✅ Team found in hardcoded list: ${teamName}`);
        return missingTeams[teamName];  // Return the hardcoded team_id
      }

      // Try to find the team alias
      const { data: aliasData, error: aliasError } = await supabase
        .from('team_aliases')
        .select('team_id')
        .eq('alias_name', teamName)
        .single();

      // If alias is not found, look up directly in the teams table
      if (aliasError || !aliasData) {
        console.log(`⚠️ Alias not found for team: ${teamName}. Searching in teams table...`);
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('id')
          .eq('team_name', teamName)
          .single();

        if (teamError || !teamData) {
          console.warn(`❌ Team not found in database: ${teamName}`);
          return null;  // Return null if no team found in both tables
        }

        console.log(`✅ Team found in teams table: ${teamName}`);
        return teamData.id;
      }

      // Return the team_id from the alias if found
      return aliasData.team_id;
    }

    // Process each game record
    for (const game of gameData) {
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

      // Fetch internal team_id using team alias or teams table or hardcoded list
      const homeTeamId = await getTeamId(game.home_team);
      const awayTeamId = await getTeamId(game.away_team);

      if (!homeTeamId || !awayTeamId) {
        console.warn(`❌ No team found for game ${game.id} between ${game.home_team} and ${game.away_team}`);
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

      console.log("📥 Upserting Game Record:", {
        tournament_day,
        winning_api_team: winner,
        winning_team_id: winner === game.home_team ? homeTeamId : awayTeamId,
        updated_at: formattedUpdatedAt,
      });

      // Upsert game result in the Supabase database
      const { error: upsertError } = await supabase
        .from("games")
        .upsert(
          [
            {
              tournament_day,
              winning_api_team: winner,
              winning_team_id: winner === game.home_team ? homeTeamId : awayTeamId,
              updated_at: formattedUpdatedAt,
            },
          ],
          { onConflict: "tournament_day,winning_api_team" }
        );

      if (upsertError) {
        console.error("❌ Upsert failed for", winner, upsertError);
        failCount++;
      } else {
        console.log(`✅ Successfully upserted: ${winner} on Day ${tournament_day}`);
        successCount++;
      }
    }

    // Return response with counts
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
