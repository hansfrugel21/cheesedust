// ✅ Full Index File with Admin Trigger Button to Update Games

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
  const [eliminatedData, setEliminatedData] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchExistingUsers();
    fetchSubmittedPicks();
    fetchComments();
    fetchEliminations();
    checkGameStatus();
  }, []);

  const checkGameStatus = () => {
    const firstGameTimes = {
      1: new Date("2025-03-20T12:00:00"),
      2: new Date("2025-03-21T12:00:00"),
      3: new Date("2025-03-22T12:10:00")
    };
    const currentTime = new Date();
    const status = {};
    Object.entries(firstGameTimes).forEach(([day, time]) => {
      status[day] = currentTime >= time;
    });
    setGameStartedDays(status);
  };

  const fetchExistingUsers = async () => {
    const { data } = await supabase.from("users").select("username, email");
    setExistingUsers(data.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })));
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
  };

  const fetchComments = async () => {
    const { data } = await supabase.from("comments").select("id, username, comment_text, created_at, parent_id").order("created_at");
    setComments(data || []);
  };

  const handleAddComment = async (parentId = null) => {
    if (!newComment.trim() || !currentUser) return;
    await supabase.from("comments").insert([
      { user_id: currentUser.id, username: currentUser.username, comment_text: newComment, parent_id: parentId }
    ]);
    setNewComment("");
    fetchComments();
  };

  const renderComments = (parentId = null, level = 0) => {
    return comments
      .filter(comment => comment.parent_id === parentId)
      .map(comment => (
        <div key={comment.id} style={{ marginLeft: level * 20, padding: "10px", background: "#fff", borderRadius: "8px", marginBottom: "10px", border: "1px solid #ddd" }}>
          <b>{comment.username}</b>: {comment.comment_text}
          <div style={{ fontSize: "12px", color: "gray" }}>{new Date(comment.created_at).toLocaleString()}</div>
          {isLoggedIn && <button style={{ marginTop: "5px", fontSize: "12px" }} onClick={() => handleAddComment(comment.id)}>Reply</button>}
          {renderComments(comment.id, level + 1)}
        </div>
      ));
  };

  const fetchSubmittedPicks = async () => {
    const { data } = await supabase
      .from("picks")
      .select("username, tournament_day, team_id, date, teams(team_name)")
      .order("date", { ascending: false });

    const latestPicks = {};
    data?.forEach((entry) => {
      const key = `${entry.username}-${entry.tournament_day}`;
      if (!latestPicks[key]) latestPicks[key] = entry;
    });
    setPicksTable(Object.values(latestPicks));
  };

  const fetchEliminations = async () => {
    const { data: picks } = await supabase.from("picks").select("username, tournament_day, team_id");
    const { data: results } = await supabase.from("games").select("tournament_day, winning_team_id");

    const winnersByDay = {};
    results.forEach(r => {
      if (!winnersByDay[r.tournament_day]) winnersByDay[r.tournament_day] = new Set();
      winnersByDay[r.tournament_day].add(r.winning_team_id);
    });

    const eliminatedList = [];
    const userPicksByDay = {};
    picks.forEach((pick) => {
      if (!userPicksByDay[pick.username]) userPicksByDay[pick.username] = {};
      userPicksByDay[pick.username][pick.tournament_day] = pick.team_id;
    });

    Object.entries(userPicksByDay).forEach(([user, picksPerDay]) => {
      for (let day = 1; day <= Object.keys(winnersByDay).length; day++) {
        if (picksPerDay[day] && !winnersByDay[day]?.has(picksPerDay[day])) {
          eliminatedList.push({ username: user, eliminatedOnDay: day + 1 });
          break;
        }
      }
    });

    setEliminatedData(eliminatedList);
  };

  const submitPick = async () => {
    if (!pick || !tournamentDay) {
      setErrorMessage("Select a team and day.");
      return;
    }
    if (gameStartedDays[tournamentDay]) {
      setErrorMessage("Picks closed for this day.");
      return;
    }
    await supabase.from("picks").insert([
      { user_id: currentUser.id, username: currentUser.username, team_id: pick, tournament_day: parseInt(tournamentDay, 10), date: new Date().toISOString() }
    ]);
    fetchSubmittedPicks();
  };

  // ✅ Admin Trigger for Game Update
  const triggerGameUpdate = async () => {
    const response = await fetch("/api/updateGames");
    const data = await response.json();
    alert(data.message || "Game update complete");
  };

  const uniqueUsers = [...new Set(picksTable.map((entry) => entry.username))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const days = [...new Set(picksTable.map((entry) => entry.tournament_day))].sort((a, b) => a - b);

  return (
    <div style={{ background: "transparent", padding: "20px", fontFamily: "Arial, sans-serif", color: "#333" }}>
      <h2 style={{ color: "#4A2E12" }}>March Madness Pool</h2>

      {!isLoggedIn && (
        <div>
          <select style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", marginBottom: "10px" }} onChange={(e) => setUsername(e.target.value)}>
            <option value="">Select user</option>
            {existingUsers.map((user) => (<option key={user.username} value={user.username}>{user.username}</option>))}
          </select><br />
          <input style={{ padding: "10px", width: "250px", borderRadius: "8px", border: "1px solid #ccc" }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><br />
          <button style={{ backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "8px", border: "none", marginTop: "10px" }} onClick={handleLogin}>Login</button>
          {errorMessage && <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>}
        </div>
      )}

      {/* ✅ Admin Button to Trigger Update */}
      {isLoggedIn && currentUser?.username === 'Admin' && (
        <button onClick={triggerGameUpdate} style={{ backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "8px", border: "none", marginTop: "20px" }}>
          Update Game Results
        </button>
      )}

      <h3 style={{ color: "#4A2E12" }}>Comments</h3>
      <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #ccc", padding: "10px", borderRadius: "8px" }}>{renderComments()}</div>
      {isLoggedIn && (
        <div>
          <textarea rows="3" style={{ width: "100%", padding: "10px", borderRadius: "8px", marginTop: "10px" }} placeholder="Write a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
          <button style={{ backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "8px", border: "none", marginTop: "10px" }} onClick={() => handleAddComment(null)}>Post Comment</button>
        </div>
      )}

      {isLoggedIn && (
        <div style={{ marginTop: "20px" }}>
          <h3 style={{ color: "#4A2E12" }}>Make Your Pick</h3>
          <select style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }} onChange={(e) => setTournamentDay(e.target.value)} value={tournamentDay}>
            <option value="">Select Day</option>
            {[...Array(10)].map((_, i) => (<option key={i + 1} value={i + 1}>Day {i + 1}</option>))}
          </select>
          <select style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc", marginLeft: "10px" }} onChange={(e) => setPick(e.target.value)} value={pick}>
            <option value="">Select Team</option>
            {teams.map((team) => (<option key={team.id} value={team.id}>{team.team_name}</option>))}
          </select>
          <button style={{ backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "8px", border: "none", marginLeft: "10px" }} onClick={submitPick}>Submit Pick</button>
        </div>
      )}

      <h3 style={{ color: "#4A2E12", marginTop: "30px" }}>Submitted Picks</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff", borderRadius: "8px", overflow: "hidden" }}>
        <thead style={{ backgroundColor: "#f4b942", color: "#222" }}>
          <tr>
            <th style={{ padding: "10px", border: "1px solid #ddd" }}>User</th>
            {days.map((day) => (<th key={day} style={{ padding: "10px", border: "1px solid #ddd" }}>Day {day}</th>))}
          </tr>
        </thead>
        <tbody>
          {uniqueUsers.map((user, idx) => {
            const eliminated = eliminatedData.find(e => e.username === user);
            return (
              <tr key={idx} style={{ backgroundColor: eliminated ? "#eee" : "white" }}>
                <td style={{ padding: "10px", border: "1px solid #ddd" }}>{user}</td>
                {days.map((day) => {
                  const pickEntry = picksTable.find(
                    (entry) => entry.username === user && entry.tournament_day === day
                  );
                  if (eliminated && day >= eliminated.eliminatedOnDay) {
                    return <td key={day} style={{ padding: "10px", border: "1px solid #ddd" }}>Eliminated</td>;
                  }
                  return (
                    <td key={day} style={{ padding: "10px", border: "1px solid #ddd" }}>
                      {pickEntry
                        ? (gameStartedDays[day] || (isLoggedIn && currentUser?.username === user))
                          ? pickEntry.teams.team_name
                          : "Submitted"
                        : ""}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {isLoggedIn && <button style={{ marginTop: "20px", backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "8px", border: "none" }} onClick={() => setIsLoggedIn(false)}>Logout</button>}
    </div>
  );
}
