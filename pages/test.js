import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [username, setUsername] = useState("");
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

  useEffect(() => {
    const fetchData = async () => {
      await fetchExistingUsers();
      await fetchComments();
      await fetchSubmittedPicks();
      checkGameStatus();
    };

    fetchData();
  }, []);

  const checkGameStatus = () => {
    const firstGameTimes = {
      1: new Date("2025-03-20T12:00:00"),
      2: new Date("2025-03-21T12:00:00"),
      3: new Date("2025-03-22T12:10:00"),
      4: new Date("2025-03-23T12:10:00"),
      5: new Date("2025-03-27T12:10:00"),
      6: new Date("2025-03-28T12:00:00"),
      7: new Date("2025-03-29T18:10:00"),
      8: new Date("2025-03-30T14:20:00"),
    };
    const currentTime = new Date();
    const newGameStartedDays = {};
    Object.entries(firstGameTimes).forEach(([day, gameTime]) => {
      newGameStartedDays[day] = currentTime >= gameTime;
    });
    setGameStartedDays(newGameStartedDays);
  };

  const fetchExistingUsers = async () => {
    try {
      const { data } = await supabase.from("users").select("username, email");
      setExistingUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleLogin = async () => {
    setErrorMessage("");
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
    try {
      const { data } = await supabase
        .from("comments")
        .select("id, username, comment_text, created_at, parent_id")
        .order("created_at", { ascending: true });
      setComments(data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleAddComment = async (parentId = null) => {
    if (!newComment.trim() || !currentUser) return;
    try {
      await supabase.from("comments").insert([
        { user_id: currentUser.id, username: currentUser.username, comment_text: newComment, parent_id: parentId }
      ]);
      setNewComment("");
      fetchComments();
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const fetchTeamsForDay = async () => {
    if (!tournamentDay) {
      setTeams([]);
      return;
    }
    try {
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
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  useEffect(() => {
    fetchTeamsForDay();
  }, [tournamentDay]);

  const fetchSubmittedPicks = async () => {
    try {
      const { data } = await supabase
        .from("picks")
        .select("username, tournament_day, team_id, created_at, teams(team_name)")
        .order("created_at", { ascending: false });

      // Log fetched picks for debugging
      console.log("Fetched Picks:", data);

      const latestPicks = {};

      // Store only the most recent pick for each user and day
      data?.forEach((entry) => {
        const key = `${entry.username}-${entry.tournament_day}`; 
        if (!latestPicks[key] || new Date(entry.created_at) > new Date(latestPicks[key].created_at)) {
          latestPicks[key] = entry;
        }
      });

      console.log("Latest Picks (after filtering):", latestPicks);

      setPicksTable(Object.values(latestPicks));  
    } catch (error) {
      console.error("Error fetching submitted picks:", error);
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
    try {
      await supabase.from("picks").insert([
        {
          user_id: currentUser.id,
          username: currentUser.username,
          team_id: pick,
          tournament_day: parseInt(tournamentDay, 10),
          created_at: new Date().toISOString(),
        },
      ]);
      fetchSubmittedPicks();
    } catch (error) {
      console.error("Error submitting pick:", error);
    }
  };

  const uniqueUsers = [...new Set(picksTable.map((entry) => entry.username))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const days = [...new Set(picksTable.map((entry) => entry.tournament_day))]
    .sort((a, b) => a - b);

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
        </div>
      )}

      <h2 style={{ borderBottom: "2px solid #f4b942", paddingBottom: "5px" }}>Comments</h2>
      <div style={{ maxHeight: "300px", overflowY: "auto", paddingRight: "10px" }}>
        {comments.map((comment) => (
          <div key={comment.id}>
            <b>{comment.username}</b>: {comment.comment_text}
            <div>{new Date(comment.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {isLoggedIn && (
        <div style={{ marginBottom: "30px" }}>
          <h2>Make Your Pick</h2>
          <select onChange={(e) => setTournamentDay(e.target.value)}>
            <option value="">Select Day</option>
            {[...Array(10)].map((_, i) => (<option key={i + 1} value={i + 1}>Day {i + 1}</option>))}
          </select>
          <select onChange={(e) => setPick(e.target.value)}>
            <option value="">Select Team</option>
            {teams.map((team) => (<option key={team.id} value={team.id}>{team.team_name}</option>))}
          </select>
          <button onClick={submitPick}>Submit Pick</button>
          {errorMessage && <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>}
        </div>
      )}

      <h2 style={{ borderBottom: "2px solid #f4b942", paddingBottom: "5px" }}>Submitted Picks</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#f4b942", color: "#fff" }}>
            <th>Username</th>
            {days.map((day) => (<th key={day}>Day {day}</th>))}
          </tr>
        </thead>
        <tbody>
          {uniqueUsers.map((user) => (
            <tr key={user}>
              <td>{user}</td>
              {days.map((day) => {
                const pickEntry = picksTable.find(entry => entry.username === user && entry.tournament_day === day);
                return (
                  <td key={day}>
                    {pickEntry ? pickEntry.teams.team_name : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
