// ✅ Updated with auto-refresh, auto-pick fallback logic, and restored fetch functions

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

  const fetchExistingUsers = async () => {
    const { data, error } = await supabase.from("users").select("username, email");
    if (!error) {
      setExistingUsers(data.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })));
    }
  };

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

// 🔥 The rest of the code (rendering, team fetching, submitPick, UI) remains intact
}
<div style={{ background: "transparent", padding: "20px", fontFamily: "Arial, sans-serif", color: "#333" }}>
      {!isLoggedIn && (
        <div style={{ marginBottom: "30px" }}>
          <h3 style={{ color: "#444" }}>Login to Submit Picks and Comment</h3>
          <select style={{ padding: "10px", borderRadius: "5px", marginBottom: "10px" }} onChange={(e) => setUsername(e.target.value)}>
            <option value="">Select user</option>
            {existingUsers.map((user) => (
              <option key={user.username} value={user.username}>{user.username}</option>
            ))}
          </select><br />
          <input style={{ padding: "10px", width: "250px", borderRadius: "5px", marginBottom: "10px" }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><br />
          <button style={{ backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "5px", border: "none" }} onClick={handleLogin}>Login</button>
          {errorMessage && <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>}
          {successMessage && <div style={{ color: "green", marginTop: "10px" }}>{successMessage}</div>}
        </div>
      )}

      <h2 style={{ borderBottom: "2px solid #f4b942", paddingBottom: "5px" }}>Comments</h2>
      <div style={{ maxHeight: "300px", overflowY: "auto", paddingRight: "10px" }}>
        {renderComments()}
      </div>
      {isLoggedIn && (
        <div style={{ marginBottom: "30px" }}>
          <textarea rows="3" style={{ width: "100%", padding: "10px", borderRadius: "8px" }} placeholder="Write a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
          <button style={{ backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "5px", border: "none", marginTop: "10px" }} onClick={() => handleAddComment(null)}>Post Comment</button>
        </div>
      )}

      {isLoggedIn && (
        <div style={{ marginBottom: "30px" }}>
          <h2 style={{ borderBottom: "2px solid #f4b942", paddingBottom: "5px" }}>Make Your Pick</h2>
          <select style={{ padding: "10px", borderRadius: "5px", marginRight: "10px" }} onChange={(e) => setTournamentDay(e.target.value)} value={tournamentDay}>
            <option value="">Select Day</option>
            {[...Array(10)].map((_, i) => (<option key={i + 1} value={i + 1}>Day {i + 1}</option>))}
          </select>
          <select style={{ padding: "10px", borderRadius: "5px", marginRight: "10px" }} onChange={(e) => setPick(e.target.value)} value={pick}>
            <option value="">Select Team</option>
            {teams.map((team) => (<option key={team.id} value={team.id}>{team.team_name}</option>))}
          </select>
          <button style={{ backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "5px", border: "none" }} onClick={submitPick}>Submit Pick</button>
          {errorMessage && <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>}
        </div>
      )}

      <h2 style={{ borderBottom: "2px solid #f4b942", paddingBottom: "5px" }}>Submitted Picks</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff", border: "1px solid #ddd" }}>
        <thead>
          <tr style={{ backgroundColor: "#f4b942", color: "#fff" }}>
            <th style={{ padding: "10px", border: "1px solid #ddd" }}>Username</th>
            {days.map((day) => (<th key={day} style={{ padding: "10px", border: "1px solid #ddd" }}>Day {day}</th>))}
          </tr>
        </thead>
        <tbody>
          {uniqueUsers.map((user, idx) => (
            <tr key={user} style={{ backgroundColor: idx % 2 === 0 ? "#fdf5e6" : "#fff" }}>
              <td style={{ padding: "10px", border: "1px solid #ddd" }}>{user}</td>
              {days.map((day) => {
                const pickEntry = picksTable.find(
                  (entry) => entry.username === user && entry.tournament_day === day
                );
                return (
                  <td style={{ padding: "10px", border: "1px solid #ddd" }} key={day}>
                    {pickEntry ? (
                      (gameStartedDays[day] || (isLoggedIn && currentUser?.username === user))
                        ? pickEntry.teams.team_name
                        : "Submitted"
                    ) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {isLoggedIn && <button style={{ marginTop: "20px", backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "5px", border: "none" }} onClick={() => setIsLoggedIn(false)}>Logout</button>}
    </div>
  );
}
