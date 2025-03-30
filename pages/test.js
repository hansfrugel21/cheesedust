import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [existingUsers, setExistingUsers] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [picksTable, setPicksTable] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [gameStartedDays, setGameStartedDays] = useState({});

  useEffect(() => {
    fetchExistingUsers();
    fetchSubmittedPicks();
    checkGameStatus();
  }, []);

  // Check the status of the games
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

  // Fetch the existing users to populate the login dropdown
  const fetchExistingUsers = async () => {
    const { data, error } = await supabase.from("users").select("username, email");
    if (error) {
      setErrorMessage("Error fetching users: " + error.message);
      return;
    }
    setExistingUsers(data.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" })));
    console.log("Fetched Users:", data); // Log for debugging
  };

  // Fetch the submitted picks
  const fetchSubmittedPicks = async () => {
    const { data, error } = await supabase
      .from("picks")
      .select("username, tournament_day, team_id, created_at, teams(team_name)")
      .order("created_at", { ascending: false }); // Order by created_at to get most recent picks first

    if (error) {
      setErrorMessage("Error fetching picks: " + error.message);
      return;
    }

    const latestPicks = {};
    data?.forEach((entry) => {
      const key = `${entry.username}-${entry.tournament_day}`; // Unique key for user and day
      if (!latestPicks[key]) {
        latestPicks[key] = entry; // Store only the most recent pick for each user and day
      }
    });

    console.log("Fetched Picks:", latestPicks); // Log fetched picks for debugging
    setPicksTable(Object.values(latestPicks)); // Convert map to array and store it
  };

  // Handle user login
  const handleLogin = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, email")
      .eq("username", username)
      .eq("email", email)
      .single();

    if (error) {
      setErrorMessage("User not found or email mismatch");
      return;
    }

    setCurrentUser(user);
    setIsLoggedIn(true);
    fetchSubmittedPicks();
  };

  // Render the picks table
  const renderPicksTable = () => {
    const uniqueUsers = [...new Set(picksTable.map((entry) => entry.username))]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    const days = [...new Set(picksTable.map((entry) => entry.tournament_day))].sort((a, b) => a - b);

    return (
      <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff", border: "1px solid #ddd" }}>
        <thead>
          <tr style={{ backgroundColor: "#f4b942", color: "#fff" }}>
            <th style={{ padding: "10px", border: "1px solid #ddd" }}>Username</th>
            {days.map((day) => (
              <th key={day} style={{ padding: "10px", border: "1px solid #ddd" }}>Day {day}</th>
            ))}
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
                  <td key={day} style={{ padding: "10px", border: "1px solid #ddd" }}>
                    {pickEntry ? pickEntry.teams?.team_name : "No Pick"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", color: "#333" }}>
      {!isLoggedIn && (
        <div style={{ marginBottom: "30px" }}>
          <h3 style={{ color: "#444" }}>Login to Submit Picks</h3>
          <select onChange={(e) => setUsername(e.target.value)} value={username}>
            <option value="">Select user</option>
            {existingUsers.map((user) => (
              <option key={user.username} value={user.username}>{user.username}</option>
            ))}
          </select><br />
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "10px", marginBottom: "10px" }}
          /><br />
          <button onClick={handleLogin}>Login</button>
          {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}
          {successMessage && <div style={{ color: "green" }}>{successMessage}</div>}
        </div>
      )}

      <h2 style={{ borderBottom: "2px solid #f4b942", paddingBottom: "5px" }}>Picks</h2>
      <div>{renderPicksTable()}</div>
    </div>
  );
}
