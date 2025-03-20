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
        setTeams(teamData);
      } else {
        setTeams([]);
      }
    };

    fetchTeamsForDay();
  }, [tournamentDay]);

  useEffect(() => {
    fetchExistingUsers();
    fetchSubmittedPicks();
    checkGameStatus();
  }, []);

  const checkGameStatus = () => {
    // Example: Map of tournament day -> first game time
    const firstGameTimes = {
      1: new Date("2025-03-20T12:00:00"),
      2: new Date("2025-03-21T12:00:00"),
      3: new Date("2025-03-22T12:00:00")
      // Add more days as needed
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
    if (!error) setExistingUsers(data);
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

  const autoPickForUsers = async () => {
    const { data: users } = await supabase.from("users").select("id, username");
    const { data: picksToday } = await supabase
      .from("picks")
      .select("username")
      .eq("tournament_day", tournamentDay);

    const pickedUsernames = picksToday?.map((p) => p.username) || [];

    for (const user of users) {
      if (!pickedUsernames.includes(user.username)) {
        const { data: userPicks } = await supabase
          .from("picks")
          .select("team_id")
          .eq("username", user.username);
        const pickedTeams = userPicks.map((p) => p.team_id);

        const { data: scheduledTeams } = await supabase
          .from("team_schedule")
          .select("team_id, seed, ap_rank")
          .eq("tournament_day", tournamentDay)
          .order("seed", { ascending: true })
          .order("ap_rank", { ascending: true });

        const teamToPick = scheduledTeams.find(
          (team) => !pickedTeams.includes(team.team_id)
        );

        if (teamToPick) {
          await supabase.from("picks").insert([
            {
              user_id: user.id,
              username: user.username,
              team_id: teamToPick.team_id,
              tournament_day: parseInt(tournamentDay, 10),
              date: new Date().toISOString(),
            },
          ]);
        }
      }
    }
    fetchSubmittedPicks();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setTournamentDay("");
    setTeams([]);
  };

  return (
    <div style={{ padding: "20px" }}>
      {!isLoggedIn ? (
        <div>
          <Div hidden><h2>Sign Up</h2>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input placeholder="Venmo ID" value={venmo} onChange={(e) => setVenmo(e.target.value)} />
          <button onClick={handleSignUp}>Sign Up</button></div>

          <h3>Login</h3>
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
      ) : (
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

          <h2>Submitted Picks</h2>
          <ul>
            {picksTable.map((entry, idx) => (
              <li key={idx}>
                {entry.username} - Day {entry.tournament_day} - {
                  (gameStartedDays[entry.tournament_day] || previewMode) ? entry.teams.team_name : "Submitted"
                }
              </li>
            ))}
          </ul>

          <button onClick={handleLogout}>Logout</button>
        </div>
      )}
    </div>
  );
}

