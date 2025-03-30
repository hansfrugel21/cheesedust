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

  useEffect(() => {
    fetchExistingUsers();
    fetchSubmittedPicks();
  }, []);

  const fetchExistingUsers = async () => {
    try {
      const { data, error } = await supabase.from("users").select("username, email");
      if (error) throw error;
      setExistingUsers(data.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" })));
      console.log("Fetched Users:", data);  // Log for debugging
    } catch (error) {
      setErrorMessage("Error fetching users: " + error.message);
    }
  };

  const fetchSubmittedPicks = async () => {
    try {
      const { data, error } = await supabase
        .from("picks")
        .select("username, tournament_day, team_id, date, teams(team_name)")
        .order("created_at", { ascending: false }); // Order by created_at to get most recent picks first

      if (error) throw error;

      const latestPicks = {};
      data?.forEach((entry) => {
        const key = `${entry.username}-${entry.tournament_day}`;
        if (!latestPicks[key]) {
          latestPicks[key] = entry;  // Store the most recent pick for each user and day
        }
      });

      console.log("Fetched Picks:", latestPicks);  // Log fetched picks
      setPicksTable(Object.values(latestPicks));  // Convert map to array and store it

    } catch (error) {
      setErrorMessage("Error fetching picks: " + error.message);
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

    if (error) {
      setErrorMessage("User not found or email mismatch");
      return;
    }

    setCurrentUser(user);
    setIsLoggedIn(true);
    fetchSubmittedPicks();
  };

  const renderPicksTable = () => {
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff", border: "1px solid #ddd" }}>
        <thead>
          <tr style={{ backgroundColor: "#f4b942", color: "#fff" }}>
            <th style={{ padding: "10px", border: "1px solid #ddd" }}>Username</th>
            <th style={{ padding: "10px", border: "1px solid #ddd" }}>Day</th>
            <th style={{ padding: "10px", border: "1px solid #ddd" }}>Pick</th>
          </tr>
        </thead>
        <tbody>
          {picksTable.map((pick, idx) => (
            <tr key={pick.username + "-" + pick.tournament_day} style={{ backgroundColor: idx % 2 === 0 ? "#fdf5e6" : "#fff" }}>
              <td style={{ padding: "10px", border: "1px solid #ddd" }}>{pick.username}</td>
              <td style={{ padding: "10px", border: "1px solid #ddd" }}>Day {pick.tournament_day}</td>
              <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                {pick.teams?.team_name ? pick.teams.team_name : "No Pick"}
              </td>
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
