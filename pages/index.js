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
  const [gameStarted, setGameStarted] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

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
    const firstGameTime = new Date("2025-03-19T12:00:00");
    const currentTime = new Date();
    setGameStarted(currentTime >= firstGameTime);
    if (currentTime >= firstGameTime) autoPickForUsers();
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
    if (!username || !email || !venmo) {
      alert("Please enter a username and email.");
      return;
    }
    const { data: existingUser } = await supabase
      .from("users")
      .select("username")
      .eq("username", username)
      .single();

    if (existingUser) {
      alert("Username taken");
      return;
    }
    await supabase.from("users").insert([{ username, email, venmo }]);
    alert("Signup successful!");
    fetchExistingUsers();
  };

  const handleLogin = async () => {
    const { data: user } = await supabase
      .from("users")
      .select("id, username, email")
      .eq("username", username)
      .eq("email", email)
      .single();

    if (!user) {
      alert("User not found or email mismatch");
      return;
    }
    setCurrentUser(user);
    setIsLoggedIn(true);
    fetchSubmittedPicks();
  };

  const submitPick = async () => {
    if (!pick || !tournamentDay) {
      alert("Select a team and day");
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

    alert("Pick submitted");
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
      <h1>March Madness Survivor Pool</h1>

      {!isLoggedIn ? (
        <div>
          <h2>Sign Up</h2>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><br>
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} /><br>
          <input placeholder="Venmo ID" value={venmo} onChange={(e) => setVenmo(e.target.value)} /><br>
          <button onClick={handleSignUp}>Sign Up</button>

          <h3>Or Login</h3>
          <select onChange={(e) => setUsername(e.target.value)}>
            <option value="">Select user</option><br>
            {existingUsers.map((user) => (
              <option key={user.username} value={user.username}>{user.username}</option>
            ))}
          </select>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button onClick={handleLogin}>Login</button>
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

          <h2>Submitted Picks</h2>
          <ul>
            {picksTable.map((entry, idx) => (
              <li key={idx}>{entry.username} - Day {entry.tournament_day} - {(gameStarted || previewMode) ? entry.teams.team_name : "Submitted"}</li>
            ))}
          </ul>

          <button onClick={() => setPreviewMode(!previewMode)}>
            {previewMode ? "Hide Preview" : "Preview Picks"}
          </button>

          <button onClick={handleLogout}>Logout</button>

          <button onClick={() => autoPickForUsers()}>Run AutoPick Test</button>
        </div>
      )}
    </div>
  );
}
