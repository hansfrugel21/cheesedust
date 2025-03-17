import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [existingUsers, setExistingUsers] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [tournamentDay, setTournamentDay] = useState("");
  const [pick, setPick] = useState("");
  const [picksTable, setPicksTable] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [previewMode, setPreviewMode] = useState(false); 

  useEffect(() => {
    if (typeof window !== "undefined") {
      fetchExistingUsers();
      fetchSubmittedPicks();
      checkGameStatus();
    }
  }, []);

  useEffect(() => {
    if (tournamentDay && isLoggedIn) {
      fetchTeamsForDay(tournamentDay);
    }
  }, [tournamentDay, isLoggedIn]);

  const checkGameStatus = () => {
    if (typeof window === "undefined") return;
    const firstGameTime = new Date("2025-03-19T12:00:00"); 
    const currentTime = new Date();
    setGameStarted(currentTime >= firstGameTime);
  };

  const fetchExistingUsers = async () => {
    const { data, error } = await supabase.from("users").select("username, email");
    if (error) console.error("Error fetching users:", error);
    else setExistingUsers(data);
  };

  const fetchTeamsForDay = async (day) => {
    if (!day) return;

    const { data: scheduleData, error: scheduleError } = await supabase
      .from("team_schedule")
      .select("team_id")
      .eq("tournament_day", day);

    if (scheduleError) {
      console.error("Error fetching teams:", scheduleError);
      return;
    }

    if (!scheduleData || scheduleData.length === 0) {
      setTeams([]);
      return;
    }

    const teamIds = scheduleData.map(entry => entry.team_id);

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, team_name, seed, ap_rank")
      .in("id", teamIds)
      .order("seed", { ascending: true });

    if (teamError) {
      console.error("Error fetching team details:", teamError);
      return;
    }

    setTeams(teamData);
  };

  const fetchSubmittedPicks = async () => {
    const { data, error } = await supabase
      .from("picks")
      .select("username, tournament_day, team, date")
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching submitted picks:", error);
      return;
    }

    const latestPicks = {};
    data.forEach((entry) => {
      const key = `${entry.username}-${entry.tournament_day}`;
      if (!latestPicks[key]) {
        latestPicks[key] = entry;
      }
    });

    setPicksTable(Object.values(latestPicks));
  };

  const handleSignUp = async () => {
    if (!username || !email) {
      alert("Please enter a username and email.");
      return;
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .single();

    if (existingUser) {
      alert("This username is already taken. Please choose a different one.");
      return;
    }

    const { error } = await supabase.from("users").insert([{ username, email }]);

    if (error) {
      console.error("Error signing up:", error);
      alert(error.message);
      return;
    }

    alert("Signup successful! You can now log in.");
    fetchExistingUsers();
  };

  const handleLogin = async () => {
    if (!username || !email) {
      alert("Please select your username and enter your email.");
      return;
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, email")
      .eq("username", username)
      .eq("email", email)
      .single();

    if (error || !user) {
      alert("User not found. Make sure your email matches your selected username.");
      return;
    }

    setCurrentUser(user);
    setIsLoggedIn(true);
    fetchSubmittedPicks();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>March Madness Survivor Pool</h1>

      {!isLoggedIn ? (
        <div>
          <h2>Sign Up</h2>
          <input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="text" placeholder="Enter a username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <button onClick={handleSignUp}>Sign Up</button>

          <h3>Or Select an Existing User</h3>
          <select onChange={(e) => setUsername(e.target.value)}>
            <option value="">Select a user</option>
            {existingUsers.map((user) => (
              <option key={user.username} value={user.username}>
                {user.username}
              </option>
            ))}
          </select>
          <input type="email" placeholder="Confirm your email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button onClick={handleLogin}>Login</button>
        </div>
      ) : (
        <div>
          <h2>Submitted Picks</h2>
          <ul>
            {picksTable.map((entry, index) => (
              <li key={index}>
                {entry.username} - {entry.tournament_day} - {(gameStarted || previewMode) ? entry.team : "Submitted"}
              </li>
            ))}
          </ul>
          <button onClick={() => setPreviewMode(!previewMode)}>
            {previewMode ? "Hide Preview" : "Preview Picks"}
          </button>

          <button onClick={handleLogout}>Logout</button>
        </div>
      )}
    </div>
  );
}


