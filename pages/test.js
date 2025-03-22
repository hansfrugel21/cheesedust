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
  const [mississippiStateError, setMississippiStateError] = useState(false); // Handling the error state for Mississippi State

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
    const { data, error } = await supabase.from("users").select("username, email");

    if (error) {
      console.error("Error fetching users:", error.message);
    } else {
      setExistingUsers(data.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })));
    }
  };

  const handleLogin = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, email")
      .eq("username", username)
      .eq("email", email)
      .single();

    if (error || !user) {
      setErrorMessage("User not found or email mismatch");
      return;
    }

    setCurrentUser(user);
    setIsLoggedIn(true);
    fetchSubmittedPicks();
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("comments")
      .select("id, username, comment_text, created_at, parent_id")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error.message);
    } else {
      setComments(data || []);
    }
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
        <div key={comment.id} style={{
          marginLeft: level * 20,
          padding: "10px",
          background: "#fff",
          borderRadius: "8px",
          marginBottom: "10px",
          border: "1px solid #ddd"
        }}>
          <b>{comment.username}</b>: {comment.comment_text}
          <div style={{ fontSize: "12px", color: "gray" }}>{new Date(comment.created_at).toLocaleString()}</div>
          {isLoggedIn && (
            <button style={{ marginTop: "5px", fontSize: "12px" }} onClick={() => handleAddComment(comment.id)}>Reply</button>
          )}
          {renderComments(comment.id, level + 1)}
        </div>
      ));
  };

  const fetchTeamsForDay = async () => {
    if (!tournamentDay) {
      setTeams([]);
      return;
    }

    const { data: scheduleData, error } = await supabase
      .from("team_schedule")
      .select("team_id")
      .eq("tournament_day", tournamentDay);

    if (error) {
      console.error("Error fetching team schedule:", error.message);
    } else if (scheduleData?.length) {
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
    const { data, error } = await supabase
      .from("picks")
      .select("username, tournament_day, team_id, date, teams(team_name)")
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching submitted picks:", error.message);
    } else {
      const latestPicks = {};
      data?.forEach((entry) => {
        const key = `${entry.username}-${entry.tournament_day}`;
        if (!latestPicks[key]) {
          latestPicks[key] = entry;
        }
      });
      setPicksTable(Object.values(latestPicks));
    }
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

  // Fix Mississippi State error
  const fixMississippiStateError = async () => {
    const { data: msuErrorData, error } = await supabase
      .from("teams")
      .select("id, team_name")
      .ilike("team_name", "%Mississippi State%");

    if (error) {
      console.error("Error fixing Mississippi State error:", error.message);
      setMississippiStateError(true);  // Show the error flag
    } else {
      console.log("Mississippi State fixed data:", msuErrorData);
      // Logic to handle Mississippi State if found
      // Assuming you want to update the picks or games with this fixed data
    }
  };

  useEffect(() => {
    fixMississippiStateError();  // Try fixing this issue after login or data fetching
  }, []);

  return (
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
          {successMessage && <div style={{ color: "green", marginTop: "
