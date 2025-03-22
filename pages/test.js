// ✅ Updated index.js with correct elimination tracking per day, darker headers, and restored button styles matching cheesedust.super.site

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [existingUsers, setExistingUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tournamentDay, setTournamentDay] = useState("");
  const [pick, setPick] = useState("");
  const [picksTable, setPicksTable] = useState([]);
  const [gameStartedDays, setGameStartedDays] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [eliminatedData, setEliminatedData] = useState([]); // {username, eliminatedOnDay}

  useEffect(() => {
    fetchExistingUsers();
    fetchSubmittedPicks();
    fetchComments();
    fetchEliminations();
    checkGameStatus();

    const interval = setInterval(() => {
      fetchSubmittedPicks();
      fetchEliminations();
      checkGameStatus();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const fetchExistingUsers = async () => {
    const { data } = await supabase.from("users").select("username, email");
    setExistingUsers(
      data?.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })) || []
    );
  };

  const fetchTeamsForDay = async (day) => {
    const { data: scheduleData } = await supabase
      .from("team_schedule")
      .select("team_id")
      .eq("tournament_day", day);

    if (scheduleData?.length) {
      const teamIds = scheduleData.map((entry) => entry.team_id);
      const { data: teamData } = await supabase
        .from("teams")
        .select("id, team_name")
        .in("id", teamIds);
      setTeams(teamData.sort((a, b) => a.team_name.localeCompare(b.team_name)));
    } else {
      setTeams([]);
    }
  };

  useEffect(() => {
    if (tournamentDay) fetchTeamsForDay(tournamentDay);
  }, [tournamentDay]);

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

  const fetchEliminations = async () => {
    const { data: picks } = await supabase
      .from("picks")
      .select("username, tournament_day, team_id")
      .order("tournament_day", { ascending: true });

    const { data: results } = await supabase.from("games").select("tournament_day, winning_team_id");
    const winnersByDay = {};
    results.forEach(r => {
      if (!winnersByDay[r.tournament_day]) winnersByDay[r.tournament_day] = new Set();
      winnersByDay[r.tournament_day].add(r.winning_team_id);
    });

    const eliminatedList = [];
    const userPicksByDay = {};
    picks.forEach((pick) => {
      if (!userPicksByDay[pick.username]) userPicksByDay[pick.username] = {};
      userPicksByDay[pick.username][pick.tournament_day] = pick.team_id;
    });

    Object.entries(userPicksByDay).forEach(([user, picksPerDay]) => {
      for (let day = 1; day <= Object.keys(winnersByDay).length; day++) {
        if (picksPerDay[day]) {
          if (!winnersByDay[day] || !winnersByDay[day].has(picksPerDay[day])) {
            eliminatedList.push({ username: user, eliminatedOnDay: day + 1 });
            break;
          }
        } else if (gameStartedDays[day]) {
          eliminatedList.push({ username: user, eliminatedOnDay: day + 1 });
          break;
        }
      }
    });

    setEliminatedData(eliminatedList);
  };

  const checkGameStatus = () => {
    const firstGameTimes = {
      1: new Date("2025-03-20T12:00:00"),
      2: new Date("2025-03-21T12:00:00"),
      3: new Date("2025-03-22T12:10:00")
    };
    const currentTime = new Date();
    const newGameStartedDays = {};
    Object.entries(firstGameTimes).forEach(([day, gameTime]) => {
      newGameStartedDays[day] = currentTime >= gameTime;
    });
    setGameStartedDays(newGameStartedDays);
  };

  const handleLogin = async () => {
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

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, username, comment_text, created_at, parent_id")
      .order("created_at", { ascending: true });
    setComments(data || []);
  };

  const renderComments = (parentId = null, level = 0) => {
    return comments
      .filter((c) => c.parent_id === parentId)
      .map((c) => (
        <div key={c.id} style={{ marginLeft: level * 20, padding: "8px", borderLeft: level ? "1px solid #ccc" : "none" }}>
          <strong>{c.username}</strong>: {c.comment_text}
          <div style={{ fontSize: "12px", color: "gray" }}>{new Date(c.created_at).toLocaleString()}</div>
          {renderComments(c.id, level + 1)}
        </div>
      ));
  };

  const uniqueUsers = [...new Set(picksTable.map((entry) => entry.username))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const days = [...new Set(picksTable.map((entry) => entry.tournament_day))]
    .sort((a, b) => a - b);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", background: "transparent", color: "#333" }}>
      <h2 style={{ color: "#4A2E12" }}>March Madness Pool</h2>

      {!isLoggedIn && (
        <div>
          <select onChange={(e) => setUsername(e.target.value)}>
            <option value="">Select user</option>
            {existingUsers.map((user) => (
              <option key={user.username} value={user.username}>{user.username}</option>
            ))}
          </select>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button onClick={handleLogin}>Login</button>
          {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}
        </div>
      )}

      <h3 style={{ color: "#4A2E12" }}>Comments</h3>
      <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #ccc", padding: "10px" }}>
        {renderComments()}
      </div>

      {isLoggedIn && (
        <div>
          <h3 style={{ color: "#4A2E12" }}>Make Your Pick</h3>
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
          {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}
        </div>
      )}

      <h3 style={{ color: "#4A2E12" }}>Submitted Picks</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff" }}>
        <thead style={{ backgroundColor: "#f4b942", color: "#222" }}>
          <tr>
            <th style={{ padding: "10px", border: "1px solid #ddd" }}>User</th>
            {days.map((day) => (
              <th key={day} style={{ padding: "10px", border: "1px solid #ddd" }}>Day {day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {uniqueUsers.map((user, idx) => {
            const eliminated = eliminatedData.find(e => e.username === user);
            return (
              <tr key={idx} style={{ backgroundColor: eliminated ? "#eee" : "white" }}>
                <td style={{ padding: "10px", border: "1px solid #ddd" }}>{user}</td>
                {days.map((day) => {
                  const pickEntry = picksTable.find(
                    (entry) => entry.username === user && entry.tournament_day === day
                  );
                  if (eliminated && day >= eliminated.eliminatedOnDay) {
                    return <td key={day} style={{ padding: "10px", border: "1px solid #ddd" }}>Eliminated</td>;
                  }
                  return (
                    <td key={day} style={{ padding: "10px", border: "1px solid #ddd" }}>
                      {pickEntry
                        ? (gameStartedDays[day] || (isLoggedIn && currentUser?.username === user))
                          ? pickEntry.teams.team_name
                          : "Submitted"
                        : ""}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {isLoggedIn && <button style={{ marginTop: "20px" }} onClick={() => setIsLoggedIn(false)}>Logout</button>}
    </div>
  );
}
