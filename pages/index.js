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
  const [latestPick, setLatestPick] = useState(null);
  const [allPicks, setAllPicks] = useState([]);

  useEffect(() => {
    const getUser = async () => {
      const { data: user } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
    fetchTeams();
    fetchPicks();
  }, []);

  const fetchTeams = async () => {
    const { data, error } = await supabase.from("teams").select("team_name");
    if (!error) {
      setTeams(data.map((team) => team.team_name));
    }
  };

  const fetchPicks = async () => {
    const { data, error } = await supabase
      .from("picks")
      .select("*")
      .order("date", { ascending: false });

    if (!error && data) {
      setAllPicks(data);
      // Extract the latest pick per user (if needed, per tournament day)
      const latestPerUser = {};
      data.forEach((entry) => {
        if (!latestPerUser[entry.user_id]) {
          latestPerUser[entry.user_id] = entry;
        }
      });
      setLatestPick(latestPerUser[user?.id]);
    }
  };

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) console.error(error);
  };

  const submitPick = async () => {
    if (!pick) return alert("Please select a team");

    // Prevent picking the same team already picked before
    const alreadyPicked = allPicks.some(
      (p) => p.user_id === user.id && p.team === pick
    );
    if (alreadyPicked) {
      return alert("You have already picked this team in a previous round.");
    }

    const { error } = await supabase.from("picks").insert([
      {
        user_id: user.id,
        username,
        team: pick,
        date: new Date().toISOString(),
      },
    ]);

    if (error) console.error(error);
    else {
      alert("Pick submitted!");
      fetchPicks();
    }
  };

  return (
    <div>
      {!user ? (
        <div>
          <h2>Sign In</h2>
          <input
            type="email"
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button onClick={signIn}>Send Login Link</button>
        </div>
      ) : (
        <div>
          <h2>Welcome, {username || "Player"}</h2>
          <input
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <h3>Pick a team</h3>
          <select onChange={(e) => setPick(e.target.value)}>
            <option value="">Select a team</option>
            {teams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
          <button onClick={submitPick}>Submit Pick</button>

          <h3>Latest Pick</h3>
          {latestPick ? (
            <div>
              <p>
                {latestPick.username} picked {latestPick.team} on {" "}
                {new Date(latestPick.date).toLocaleString()}
              </p>
            </div>
          ) : (
            <p>No pick submitted yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
