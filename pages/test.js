import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [teams, setTeams] = useState([]);
  const [tournamentDay, setTournamentDay] = useState("");
  const [pick, setPick] = useState("");
  const [picksTable, setPicksTable] = useState([]);
  const [gameStartedDays, setGameStartedDays] = useState({});
  const [existingUsers, setExistingUsers] = useState([]);
  
  useEffect(() => {
    fetchExistingUsers();
    fetchSubmittedPicks();
    checkGameStatus();
  }, []);

  // This function checks if the games for each day have started
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

  // Fetch the existing users for the login dropdown
  const fetchExistingUsers = async () => {
    const { data } = await supabase.from("users").select("username, email");
    setExistingUsers(data.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })));
  };

  // Handle user login
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

  // Fetch comments from the database
  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, username, comment_text, created_at, parent_id")
      .order("created_at", { ascending: true });
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

  // Fetch teams for the selected tournament day
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

  // Use useEffect hook to fetch the teams when tournamentDay changes
  useEffect(() => {
    fetchTeamsForDay();
  }, [tournamentDay]);

  // Fetch the most recent picks for each user and day
  const fetchSubmittedPicks = async () => {
    const { data } = await supabase.rpc("get_most_recent_picks");

    const latestPicks = {};
    data?.forEach((entry) => {
      const key = `${entry.username}-${entry.tournament_day}`;
      if (!latestPicks[key]) {
        latestPicks[key] = entry;
      }
    });
    console.log(latestPicks);  // Log to see the fetched data
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

  // Rendering the data for unique users and their picks
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
                        ? pickEntry.team_name
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
