import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [picksTable, setPicksTable] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tournamentDay, setTournamentDay] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (isLoggedIn) {
      fetchSubmittedPicks();
    }
  }, [isLoggedIn]);

  const fetchSubmittedPicks = async () => {
    const { data, error } = await supabase
      .rpc("get_most_recent_picks");  // Assuming you created a SQL function for the query

    if (error) {
      setErrorMessage("Error fetching picks");
      return;
    }

    setPicksTable(data || []);
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
  };

  const uniqueUsers = [...new Set(picksTable.map((entry) => entry.username))]
    .sort((a, b) => a.localeCompare(b));

  const days = [...new Set(picksTable.map((entry) => entry.tournament_day))]
    .sort((a, b) => a - b);

  return (
    <div>
      {!isLoggedIn && (
        <div>
          <h3>Login to Submit Picks</h3>
          <input 
            type="text" 
            placeholder="Username" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
          />
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
          />
          <button onClick={handleLogin}>Login</button>
          {errorMessage && <div>{errorMessage}</div>}
        </div>
      )}

      <h2>Submitted Picks</h2>
      <table>
        <thead>
          <tr>
            <th>Username</th>
            {days.map((day) => (
              <th key={day}>Day {day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {uniqueUsers.map((user, idx) => (
            <tr key={user}>
              <td>{user}</td>
              {days.map((day) => {
                const pick = picksTable.find(
                  (entry) => entry.username === user && entry.tournament_day === day
                );
                return (
                  <td key={day}>
                    {pick ? pick.team_name : "No Pick"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {isLoggedIn && <button onClick={() => setIsLoggedIn(false)}>Logout</button>}
    </div>
  );
}
