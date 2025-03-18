import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [teams, setTeams] = useState([]);
  const [pick, setPick] = useState("");
  const [tournamentDay, setTournamentDay] = useState("");
  const [allPicks, setAllPicks] = useState([]);
  const [picksTable, setPicksTable] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [existingUsers, setExistingUsers] = useState([]);

  useEffect(() => {
    fetchTeams();
    fetchSubmittedPicks();
    fetchExistingUsers();
  }, []);

  const fetchTeams = async () => {
    const { data, error } = await supabase.from("teams").select("id, team_name");
    if (!error) {
      setTeams(data);
    }
  };

  const fetchExistingUsers = async () => {
    const { data, error } = await supabase.from("users").select("username, email");
    if (!error) setExistingUsers(data);
  };

  const fetchSubmittedPicks = async () => {
    const { data } = await supabase
      .from("picks")
      .select("username, tournament_day, team, date")
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
      alert("Username taken");
      return;
    }
    await supabase.from("users").insert([{ username, email }]);
    alert("Signup successful!");
    fetchExistingUsers();
  };

  const handleLogin = async () => {
    const { data: userData } = await supabase
      .from("users")
      .select("id, username, email")
      .eq("username", username)
      .eq("email", email)
      .single();

    if (!userData) {
      alert("User not found or email mismatch");
      return;
    }
    setUser(userData);
    setIsLoggedIn(true);
    fetchSubmittedPicks();
  };

  const submitPick = async () => {
    if (!pick || !tournamentDay) {
      alert("Select a team and day");
      return;
    }

    // Prevent re-picking the same team
    const alreadyPicked = allPicks.some(
      (p) => p.username === user.username && p.team === pick
    );
    if (alreadyPicked) {
      return alert("You have already picked this team in a previous round.");
    }

    const { data: teamData } = await supabase
      .from("teams")
      .select("team_name")
      .eq("id", pick)
      .single();

    await supabase.from("picks").insert([
      {
        user_id: user.id,
        username: user.username,
        team: teamData.team_name,
        tournament_day: parseInt(tournamentDay, 10),
        date: new Date().toISOString(),
      },
    ]);

    alert("Pick submitted");
    fetchSubmittedPicks();
  };

  const handleLogout = () => {
    setUser(null);
    setIsLoggedIn(false);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>March Madness Survivor Pool</h1>

      {!isLoggedIn ? (
        <div>
          <h2>Sign Up</h2>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <button onClick={handleSignUp}>Sign Up</button>

          <h3>Or Login</h3>
          <select onChange={(e) => setUsername(e.target.value)}>
            <option value="">Select user</option>
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
          <select onChange={(e) => setTournamentDay(e.target.value)}>
            <option value="">Select Day</option>
            {[...Array(10)].map((_, i) => (
              <option key={i + 1} value={i + 1}>Day {i + 1}</option>
            ))}
          </select>

          <select onChange={(e) => setPick(e.target.value)}>
            <option value="">Select Team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.team_name}</option>
            ))}
          </select>

          <button onClick={submitPick}>Submit Pick</button>

          <h2>Submitted Picks</h2>
          <ul>
            {picksTable.map((entry, idx) => (
              <li key={idx}>{entry.username} - Day {entry.tournament_day} - {entry.team}</li>
            ))}
          </ul>

          <button onClick={handleLogout}>Logout</button>
        </div>
      )}
    </div>
  );
}
