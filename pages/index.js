import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [username, setUsername] = useState("");
  const [venmo, setVenmo] = useState("");
  const [email, setEmail] = useState("");
  const [existingUsers, setExistingUsers] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [tournamentDay, setTournamentDay] = useState("");
  const [pick, setPick] = useState("");
  const [picksTable, setPicksTable] = useState([]);
  const [gameStartedDays, setGameStartedDays] = useState({});
  const [previewMode, setPreviewMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetchExistingUsers();
    fetchSubmittedPicks();
    checkGameStatus();
  }, []);

  useEffect(() => {
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
        const sortedTeams = teamData.sort((a, b) => a.team_name.localeCompare(b.team_name));
        setTeams(sortedTeams);
      } else {
        setTeams([]);
      }
    };
    fetchTeamsForDay();
  }, [tournamentDay]);

  const checkGameStatus = () => {
    const firstGameTimes = {
      1: new Date("2025-03-20T12:00:00"),
      2: new Date("2025-03-21T12:00:00"),
      3: new Date("2025-03-22T12:00:00")
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
    if (!error) setExistingUsers(data.sort((a, b) => a.username.localeCompare(b.username)));
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

  const handleSignUp = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    if (!username || !email || !venmo) {
      setErrorMessage("Please enter a username, email, and Venmo ID.");
      return;
    }
    const { data: existingUser } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .single();

    if (existingUser) {
      setErrorMessage("Username is taken.");
      return;
    }
    await supabase.from("users").insert([{ username, email, venmo }]);
    fetchExistingUsers();
    setSuccessMessage("Signup successful! You can now log in below.");
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

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setTournamentDay("");
    setTeams([]);
  };

  // Generate the unique list of users for the picks table
  const uniqueUsers = [...new Set(picksTable.map((entry) => entry.username))].sort();
  const days = [...new Set(picksTable.map((entry) => entry.tournament_day))].sort((a, b) => a - b);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      {!isLoggedIn && (
        <div><div hidden>
          <h2>Sign Up</h2>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input placeholder="Venmo ID" value={venmo} onChange={(e) => setVenmo(e.target.value)} />
          <button onClick={handleSignUp}>Sign Up</button></div>

          <h3>Login to submit picks</h3>
          <select onChange={(e) => setUsername(e.target.value)}>
            <option value="">Select user</option>
            {existingUsers.map((user) => (
              <option key={user.username} value={user.username}>{user.username}</option>
            ))}
          </select>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button onClick={handleLogin}>Login</button>

          {errorMessage && <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>}
          {successMessage && <div style={{ color: "green", marginTop: "10px" }}>{successMessage}</div>}
        </div>
      )}

      {isLoggedIn && (
        <div>
          <h2>Make Your Pick</h2>
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

          {errorMessage && <div style={{ color: "red", marginTop: "10px" }}>{errorMessage}</div>}
        </div>
      )}

      <h2>Submitted Picks</h2>
      <table border="1" cellPadding="5" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Username</th>
            {days.map((day) => (
              <th key={day}>Day {day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {uniqueUsers.map((user) => (
            <tr key={user}>
              <td>{user}</td>
              {days.map((day) => {
                const pickEntry = picksTable.find(
                  (entry) => entry.username === user && entry.tournament_day === day
                );
                return (
                  <td key={day}>
                    {pickEntry ? (
                      (gameStartedDays[day] || previewMode) ? pickEntry.teams.team_name : "Submitted"
                    ) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {isLoggedIn && <button onClick={handleLogout}>Logout</button>}
    </div>
  );
}
