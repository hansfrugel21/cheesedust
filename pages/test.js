import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [existingUsers, setExistingUsers] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [teams, setTeams] = useState([]);
  const [tournamentDay, setTournamentDay] = useState("");
  const [pick, setPick] = useState("");
  const [picksTable, setPicksTable] = useState([]);
  const [gameStartedDays, setGameStartedDays] = useState({});
  const [teamResults, setTeamResults] = useState([]);

  useEffect(() => {
    fetchExistingUsers();
    fetchSubmittedPicks();
    fetchComments();
    checkGameStatus();
  }, []);

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

  const fetchExistingUsers = async () => {
    const { data } = await supabase.from("users").select("username, email");
    setExistingUsers(data.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' })));
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, username, comment_text, created_at, parent_id")
      .order("created_at", { ascending: true });
    setComments(data || []);
  };

  const handleAddComment = async (parentId = null) => {
    if (!newComment.trim() || !currentUser) return;
    await supabase.from("comments").insert([
      { user_id: currentUser.id, username: currentUser.username, comment_text: newComment, parent_id: parentId }
    ]);
    setNewComment("");
    fetchComments();
  };

  const renderComments = (parentId = null, level = 0) => {
    return comments
      .filter(comment => comment.parent_id === parentId)
      .map(comment => (
        <div key={comment.id} style={{
          marginLeft: level * 20,
          padding: "10px",
          background: "#fff",
          borderRadius: "8px",
          marginBottom: "10px",
          border: "1px solid #ddd"
        }}>
          <b>{comment.username}</b>: {comment.comment_text}
          <div style={{ fontSize: "12px", color: "gray" }}>{new Date(comment.created_at).toLocaleString()}</div>
          {isLoggedIn && (
            <button style={{ marginTop: "5px", fontSize: "12px" }} onClick={() => handleAddComment(comment.id)}>Reply</button>
          )}
          {renderComments(comment.id, level + 1)}
        </div>
      ));
  };

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
      setTeams(teamData.sort((a, b) => a.team_name.localeCompare(b.team_name, undefined, { sensitivity: 'base' })));
    } else {
      setTeams([]);
    }
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

  const submitPick = async () => {
    if (!pick || !tournamentDay) return;

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

  const uniqueUsers = [...new Set(picksTable.map((entry) => entry.username))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const days = [...new Set(picksTable.map((entry) => entry.tournament_day))]
    .sort((a, b) => a - b);

  // Fetch results for all teams
  const fetchTeamResults = async () => {
    const { data: gameResults } = await supabase
      .from("games")
      .select("winning_api_team, tournament_day")
      .order("tournament_day", { ascending: true });

    const results = [];
    for (const result of gameResults) {
      const { winning_api_team, tournament_day } = result;
      results.push({ team: winning_api_team, day: tournament_day, result: "Won" });
    }
    setTeamResults(results);
  };

  useEffect(() => {
    fetchTeamsForDay();
    fetchTeamResults();
  }, [tournamentDay]);

  return (
    <div style={{ background: "transparent", padding: "20px", fontFamily: "Arial, sans-serif", color: "#333" }}>
      {/* Login form */}
      {!isLoggedIn && (
        <div style={{ marginBottom: "30px" }}>
          <h3 style={{ color: "#444" }}>Login to Submit Picks and Comment</h3>
          <select style={{ padding: "10px", borderRadius: "5px", marginBottom: "10px" }} onChange={(e) => setUsername(e.target.value)}>
            <option value="">Select user</option>
            {existingUsers.map((user) => (
              <option key={user.username} value={user.username}>{user.username}</option>
            ))}
          </select><br />
          <input style={{ padding: "10px", width: "250px", borderRadius: "5px", marginBottom: "10px" }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><br />
          <button style={{ backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "5px", border: "none" }} onClick={handleLogin}>Login</button>
        </div>
      )}

      {/* Comments section */}
      <h2 style={{ borderBottom: "2px solid #f4b942", paddingBottom: "5px" }}>Comments</h2>
      <div style={{ maxHeight: "300px", overflowY: "auto", paddingRight: "10px" }}>
        {renderComments()}
      </div>

      {/* Make a pick */}
      {isLoggedIn && (
        <div style={{ marginBottom: "30px" }}>
          <h2 style={{ borderBottom: "2px solid #f4b942", paddingBottom: "5px" }}>Make Your Pick</h2>
          <select style={{ padding: "10px", borderRadius: "5px", marginRight: "10px" }} onChange={(e) => setTournamentDay(e.target.value)} value={tournamentDay}>
            <option value="">Select Day</option>
            {[...Array(10)].map((_, i) => (<option key={i + 1} value={i + 1}>Day {i + 1}</option>))}
          </select>
          <select style={{ padding: "10px", borderRadius: "5px", marginRight: "10px" }} onChange={(e) => setPick(e.target.value)} value={pick}>
            <option value="">Select Team</option>
            {teams.map((team) => (<option key={team.id} value={team.id}>{team.team_name}</option>))}
          </select>
          <button style={{ backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "5px", border: "none" }} onClick={submitPick}>Submit Pick</button>
        </div>
      )}

      {/* Picks Table */}
      <h2 style={{ borderBottom: "2px solid #f4b942", paddingBottom: "5px" }}>Submitted Picks</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff", border: "1px solid #ddd" }}>
        <thead>
          <tr style={{ backgroundColor: "#f4b942", color: "#fff" }}>
            <th style={{ padding: "10px", border: "1px solid #ddd" }}>Username</th>
            {days.map((day) => (<th key={day} style={{ padding: "10px", border: "1px solid #ddd" }}>Day {day}</th>))}
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
                  <td style={{ padding: "10px", border: "1px solid #ddd" }} key={day}>
                    {pickEntry ? (
                      (gameStartedDays[day] || (isLoggedIn && currentUser?.username === user))
                        ? pickEntry.teams.team_name
                        : "Submitted"
                    ) : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Teams Results Table */}
      <h2 style={{ borderBottom: "2px solid #f4b942", paddingBottom: "5px" }}>Teams Results</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff", border: "1px solid #ddd" }}>
        <thead>
          <tr style={{ backgroundColor: "#f4b942", color: "#fff" }}>
            <th style={{ padding: "10px", border: "1px solid #ddd" }}>Team</th>
            <th style={{ padding: "10px", border: "1px solid #ddd" }}>Result</th>
          </tr>
        </thead>
        <tbody>
          {teamResults.sort((a, b) => a.team.localeCompare(b.team)).map((team, idx) => (
            <tr key={team.team} style={{ backgroundColor: idx % 2 === 0 ? "#fdf5e6" : "#fff" }}>
              <td style={{ padding: "10px", border: "1px solid #ddd" }}>{team.team}</td>
              <td style={{ padding: "10px", border: "1px solid #ddd" }}>{team.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
