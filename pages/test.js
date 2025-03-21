// ✅ Updated with Cheesedust design integration, styling, and conditional pick reveal

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
  }, []);

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

  const fetchExistingUsers = async () => {
    const { data } = await supabase.from("users").select("username, email");
    setExistingUsers(data.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })));
  };

  const handleLogin = async () => {
    setErrorMessage("");
    setSuccessMessage("");
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

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, username, comment_text, created_at")
      .order("created_at", { ascending: true });
    setComments(data || []);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return;
    await supabase.from("comments").insert([
      { user_id: currentUser.id, username: currentUser.username, comment_text: newComment }
    ]);
    setNewComment("");
    fetchComments();
  };

  const fetchTeamsForDay = async () => {
    if (!tournamentDay) {
      setTeams([]);
      return;
    }
    const { data: scheduleData } = await supabase
      .from("team_schedule")
      .select("team_id")
      .eq("tournament_day", tournamentDay);

    if (scheduleData?.length) {
      const teamIds = scheduleData.map((entry) => entry.team_id);
      const { data: teamData } = await supabase
        .from("teams")
        .select("id, team_name")
        .in("id", teamIds);
      setTeams(teamData.sort((a, b) => a.team_name.localeCompare(b.team_name, undefined, { sensitivity: 'base' })));
    } else {
      setTeams([]);
    }
  };

  useEffect(() => {
    fetchTeamsForDay();
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

  const uniqueUsers = [...new Set(picksTable.map((entry) => entry.username))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const days = [...new Set(picksTable.map((entry) => entry.tournament_day))]
    .sort((a, b) => a - b);

  return (
    <div style={{ background: "#fff8f0", padding: "20px", fontFamily: "Arial, sans-serif", color: "#333" }}>
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
      {comments.map((comment) => (
        <div key={comment.id} style={{ marginBottom: "15px", background: "#fff", padding: "10px", borderRadius: "8px" }}>
          <b>{comment.username}</b>: {comment.comment_text}
          <div style={{ fontSize: "12px", color: "gray" }}>{new Date(comment.created_at).toLocaleString()}</div>
        </div>
      ))}
      {isLoggedIn && (
        <div style={{ marginBottom: "30px" }}>
          <textarea rows="3" style={{ width: "100%", padding: "10px", borderRadius: "8px" }} placeholder="Write a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
          <button style={{ backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "5px", border: "none", marginTop: "10px" }} onClick={handleAddComment}>Post Comment</button>
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
      <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff" }}>
        <thead>
          <tr style={{ backgroundColor: "#f4b942", color: "#fff" }}>
            <th style={{ padding: "10px" }}>Username</th>
            {days.map((day) => (<th key={day} style={{ padding: "10px" }}>Day {day}</th>))}
          </tr>
        </thead>
        <tbody>
          {uniqueUsers.map((user, idx) => (
            <tr key={user} style={{ backgroundColor: idx % 2 === 0 ? "#fdf5e6" : "#fff" }}>
              <td style={{ padding: "10px" }}>{user}</td>
              {days.map((day) => {
                const pickEntry = picksTable.find(
                  (entry) => entry.username === user && entry.tournament_day === day
                );
                return (
                  <td style={{ padding: "10px" }} key={day}>
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
