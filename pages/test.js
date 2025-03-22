// ✅ Updated with auto-refresh and auto-pick fallback logic

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [username, setUsername] = useState("");
  const [venmo, setVenmo] = useState("");
  const [email, setEmail] = useState("");
  const [existingUsers, setExistingUsers] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [teams, setTeams] = useState([]);
  const [tournamentDay, setTournamentDay] = useState("");
  const [pick, setPick] = useState("");
  const [picksTable, setPicksTable] = useState([]);
  const [gameStartedDays, setGameStartedDays] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetchExistingUsers();
    fetchSubmittedPicks();
    fetchComments();
    checkGameStatus();

    const interval = setInterval(() => {
      fetchSubmittedPicks();
      fetchComments();
      checkGameStatus();
    }, 60000); // Refresh every 60 seconds

    return () => clearInterval(interval);
  }, []);

  const autoPickForUsers = async () => {
    if (!tournamentDay) return;
    const { data: users } = await supabase.from("users").select("id, username");
    const { data: picksToday } = await supabase
      .from("picks")
      .select("username")
      .eq("tournament_day", tournamentDay);

    const pickedUsernames = picksToday?.map((p) => p.username) || [];

    for (const user of users) {
      if (!pickedUsernames.includes(user.username)) {
        const { data: userPicks } = await supabase
          .from("picks")
          .select("team_id")
          .eq("username", user.username);
        const pickedTeams = userPicks.map((p) => p.team_id);

        const { data: scheduledTeams } = await supabase
          .from("team_schedule")
          .select("team_id")
          .eq("tournament_day", tournamentDay);

        const teamToPick = scheduledTeams.find(
          (team) => !pickedTeams.includes(team.team_id)
        );

        if (teamToPick) {
          await supabase.from("picks").insert([
            {
              user_id: user.id,
              username: user.username,
              team_id: teamToPick.team_id,
              tournament_day: parseInt(tournamentDay, 10),
              date: new Date().toISOString(),
            },
          ]);
        }
      }
    }
    fetchSubmittedPicks();
  };

  const checkGameStatus = () => {
    const firstGameTimes = {
      1: new Date("2025-03-20T12:00:00"),
      2: new Date("2025-03-21T12:00:00"),
      3: new Date("2025-03-22T12:10:00")
    };
    const currentTime = new Date();
    const newGameStartedDays = {};
    Object.entries(firstGameTimes).forEach(([day, gameTime]) => {
      newGameStartedDays[day] = currentTime >= gameTime;
    });
    setGameStartedDays(newGameStartedDays);

    // Trigger auto-pick when the game starts for that day
    Object.entries(newGameStartedDays).forEach(([day, started]) => {
      if (started) {
        setTournamentDay(day);
        autoPickForUsers();
      }
    });
  };

// 🔥 The rest of the code (rendering, fetchComments, fetchTeams, submitPick, UI) remains the same
// ✅ Your full React return block, CSS, and styles stay intact
}
