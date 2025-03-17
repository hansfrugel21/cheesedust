import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [existingUsers, setExistingUsers] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [tournamentDay, setTournamentDay] = useState("");
  const [pick, setPick] = useState("");
  const [picksTable, setPicksTable] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [previewMode, setPreviewMode] = useState(false); // Allows users to preview picks before games start

  useEffect(() => {
    fetchExistingUsers();
    fetchSubmittedPicks();
    checkGameStatus();
  }, []);

  useEffect(() => {
    if (tournamentDay && isLoggedIn) {
      fetchTeamsForDay(tournamentDay);
    }
  }, [tournamentDay, isLoggedIn]);

  const checkGameStatus = () => {
    const firstGameTime = new Date("2025-03-19T12:00:00"); // Adjust this to actual game start time
    const currentTime = new Date();
    setGameStarted(currentTime >= firstGameTime);
  };

  const fetchExistingUsers = async () => {
    const { data, error } = await supabase.from("users").select("username, email");
    if (error) console.error("Error fetching users:", error);
    else setExistingUsers(data);
  };

  const fetchTeamsForDay = async (day) => {
    if (!day) return;

    const { data: scheduleData, error: scheduleError } = await supabase
      .from("team_schedule")
      .select("team_id")
      .eq("tournament_day", day);

    if (scheduleError) {
      console.error("Error fetching teams:", scheduleError);
      return;
    }

    if (!scheduleData || scheduleData.length === 0) {
      setTeams([]);
      return;
    }

    const teamIds = scheduleData.map(entry => entry.team_id);

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, team_name, seed, ap_rank")
      .in("id", teamIds)
      .order("seed", { ascending: true });

    if (teamError) {
      console.error("Error fetching team details:", teamError);
      return;
    }

    setTeams(teamData);
  };

  const fetchSubmittedPicks = async () => {
    const { data, error } = await supabase
      .from("picks")
      .select("username, tournament_day, team, date")
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching submitted picks:", error);
      return;
    }

    // Keep only the latest pick per user per tournament day
    const latestPicks = {};
    data.forEach((entry) => {
      const key = `${entry.username}-${entry.tournament_day}`;
      if (!latestPicks[key]) {
        latestPicks[key] = entry;
      }
    });

    setPicksTable(Object.values(latestPicks));
  };

  const submitPick = async () => {
    if (!pick || !tournamentDay) {
      alert("Please select a team and a day.");
      return;
    }

    if (gameStarted) {
      alert("Picks are locked! You cannot change your selection now.");
      return;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, team_name")
      .eq("id", pick)
      .single();

    if (teamError || !teamData) {
      console.error("Error fetching team info:", teamError);
      alert("Invalid team selection.");
      return;
    }

    const { data: existingPick } = await supabase
      .from("picks")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("tournament_day", tournamentDay)
      .single();

    if (existingPick) {
      await supabase.from("picks").update({
        team: teamData.team_name,
        date: new Date().toISOString(),
      }).eq("id", existingPick.id);
    } else {
      await supabase.from("picks").insert([
        {
          user_id: currentUser.id,
          username: currentUser.username,
          team: teamData.team_name,
          tournament_day: parseInt(tournamentDay, 10),
          date: new Date().toISOString(),
        },
      ]);
    }

    alert(`Pick for Day ${tournamentDay} submitted successfully!`);
    fetchSubmittedPicks();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>March Madness Survivor Pool</h1>

      {!isLoggedIn ? (
        <div>
          <h2>Sign Up</h2>
          <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="text" placeholder="Enter a username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <button onClick={handleSignUp}>Sign Up</button>

          <h3>Or Select an Existing User</h3>
          <select onChange={(e) => setUsername(e.target.value)}>
            <option value="">Select a user</option>
            {existingUsers.map((user) => (
              <option key={user.username} value={user.username}>
                {user.username}
              </option>
            ))}
          </select>
          <input type="email" placeholder="Confirm your email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button onClick={handleLogin}>Login</button>
        </div>
      ) : (
        <div>
          <h2>Pick a Team for a Tournament Day</h2>
          <select onChange={(e) => setTournamentDay(e.target.value)}>
            <option value="">Select a day</option>
            {[...Array(10)].map((_, i) => <option key={i + 1} value={i + 1}>Day {i + 1}</option>)}
          </select>
          <select onChange={(e) => setPick(e.target.value)}>
            <option value="">Select a team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.team_name}
              </option>
            ))}
          </select>
          <button onClick={submitPick}>Submit Pick</button>

          <h2>Submitted Picks</h2>
          <ul>
            {picksTable.map((entry, index) => (
              <li key={index}>
                {entry.username} - {entry.tournament_day} - {(gameStarted || previewMode) ? entry.team : "Submitted"}
              </li>
            ))}
          </ul>
          <button onClick={() => setPreviewMode(!previewMode)}>
            {previewMode ? "Hide Preview" : "Preview Picks"}
          </button>
        </div>
      )}
    </div>
  );
}
