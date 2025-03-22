// ✅ Restored latest index.js with threaded comments, proper team dropdown, and formatting

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [existingUsers, setExistingUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tournamentDay, setTournamentDay] = useState("");
  const [pick, setPick] = useState("");
  const [picksTable, setPicksTable] = useState([]);
  const [gameStartedDays, setGameStartedDays] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    fetchExistingUsers();
    fetchSubmittedPicks();
    fetchComments();
    checkGameStatus();

    const interval = setInterval(() => {
      fetchSubmittedPicks();
      checkGameStatus();
    }, 60000); // Auto-refresh every 60s

    return () => clearInterval(interval);
  }, []);

  const fetchExistingUsers = async () => {
    const { data } = await supabase.from("users").select("username, email");
    setExistingUsers(
      data?.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })) || []
    );
  };

  const fetchTeamsForDay = async (day) => {
    const { data: scheduleData } = await supabase
      .from("team_schedule")
      .select("team_id")
      .eq("tournament_day", day);

    if (scheduleData?.length) {
      const teamIds = scheduleData.map((entry) => entry.team_id);
      const { data: teamData } = await supabase
        .from("teams")
        .select("id, team_name")
        .in("id", teamIds);
      setTeams(teamData.sort((a, b) => a.team_name.localeCompare(b.team_name)));
    } else {
      setTeams([]);
    }
  };

  useEffect(() => {
    if (tournamentDay) fetchTeamsForDay(tournamentDay);
  }, [tournamentDay]);

  const fetchSubmittedPicks = async () => {
    const { data } = await supabase
      .from("picks")
      .select("username, tournament_day, team_id, date, teams(team_name)")
      .order("date", { ascending: false });

    const latestPicks = {};
    data?.forEach((entry) => {
      const key = `${entry.username}-${entry.tournament_day}`;
      if (!latestPicks[key]) {
        latestPicks[key] = entry;
      }
    });
    setPicksTable(Object.values(latestPicks));
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, username, comment_text, created_at, parent_id")
      .order("created_at", { ascending: true });
    setComments(data || []);
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
  };

  const handleLogin = async () => {
    const { data: user } = await supabase
      .from("users")
      .select("id, username, email")
      .eq("username", username)
      .eq("email", email)
      .single();

    if (!user) {
      setErrorMessage("User not found or email mismatch");
      return;
    }
    setCurrentUser(user);
    setIsLoggedIn(true);
    fetchSubmittedPicks();
  };

  const submitPick = async () => {
    setErrorMessage("");
    if (!pick || !tournamentDay) {
      setErrorMessage("Please select a team and day.");
      return;
    }
    if (gameStartedDays[tournamentDay]) {
      setErrorMessage("Pick submission closed for this day.");
      return;
    }
    await supabase.from("picks").insert([
      {
        user_id: currentUser.id,
        username: currentUser.username,
        team_id: pick,
        tournament_day: parseInt(tournamentDay, 10),
        date: new Date().toISOString(),
      },
    ]);
    fetchSubmittedPicks();
  };

  const renderComments = (parentId = null, level = 0) => {
    return comments
      .filter((c) => c.parent_id === parentId)
      .map((c) => (
        <div key={c.id} style={{ marginLeft: level * 20, padding: "8px", borderLeft: level ? "1px solid #ccc" : "none" }}>
          <strong>{c.username}</strong>: {c.comment_text}
          <div style={{ fontSize: "12px", color: "gray" }}>{new Date(c.created_at).toLocaleString()}</div>
          {renderComments(c.id, level + 1)}
        </div>
      ));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", background: "transparent" }}>
      <h2>March Madness Pool</h2>

      {!isLoggedIn && (
        <div>
          <select onChange={(e) => setUsername(e.target.value)}>
            <option value="">Select user</option>
            {existingUsers.map((user) => (
              <option key={user.username} value={user.username}>{user.username}</option>
            ))}
          </select>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button onClick={handleLogin}>Login</button>
          {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}
        </div>
      )}

      <h3>Comments</h3>
      <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #ccc", padding: "10px" }}>
        {renderComments()}
      </div>

      {isLoggedIn && (
        <div>
          <h3>Make Your Pick</h3>
          <select onChange={(e) => setTournamentDay(e.target.value)} value={tournamentDay}>
            <option value="">Select Day</option>
            {[...Array(10)].map((_, i) => (
              <option key={i + 1} value={i + 1}>Day {i + 1}</option>
            ))}
          </select>
          <select onChange={(e) => setPick(e.target.value)} value={pick}>
            <option value="">Select Team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.team_name}</option>
            ))}
          </select>
          <button onClick={submitPick}>Submit Pick</button>
          {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}
        </div>
      )}

      <h3>Submitted Picks</h3>
      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>User</th>
            <th>Day</th>
            <th>Team</th>
          </tr>
        </thead>
        <tbody>
          {picksTable.map((entry, idx) => (
            <tr key={idx}>
              <td>{entry.username}</td>
              <td>{entry.tournament_day}</td>
              <td>{entry.teams.team_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
