// ✅ Updated with fixed elimination loop, improved button and input styling, rounded borders

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  // ... [State declarations remain unchanged]

  // ✅ Fix elimination loop by breaking correctly and preventing wrong pick render
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

  // ✅ Update styling for rounded borders, darker headers, and buttons
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", background: "transparent", color: "#333" }}>
      <h2 style={{ color: "#4A2E12" }}>March Madness Pool</h2>

      {!isLoggedIn && (
        <div style={{ marginBottom: "20px" }}>
          <select style={{ padding: "10px", borderRadius: "8px", marginBottom: "10px", border: "1px solid #ccc" }} onChange={(e) => setUsername(e.target.value)}>
            <option value="">Select user</option>
            {existingUsers.map((user) => (
              <option key={user.username} value={user.username}>{user.username}</option>
            ))}
          </select>
          <input style={{ padding: "10px", width: "250px", borderRadius: "8px", border: "1px solid #ccc", marginBottom: "10px" }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button style={{ backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "8px", border: "none" }} onClick={handleLogin}>Login</button>
          {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}
        </div>
      )}

      <h3 style={{ color: "#4A2E12" }}>Comments</h3>
      <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #ccc", padding: "10px", borderRadius: "8px" }}>
        {renderComments()}
      </div>

      {isLoggedIn && (
        <div style={{ margin: "20px 0" }}>
          <h3 style={{ color: "#4A2E12" }}>Make Your Pick</h3>
          <select style={{ padding: "10px", borderRadius: "8px", marginRight: "10px", border: "1px solid #ccc" }} onChange={(e) => setTournamentDay(e.target.value)} value={tournamentDay}>
            <option value="">Select Day</option>
            {[...Array(10)].map((_, i) => (
              <option key={i + 1} value={i + 1}>Day {i + 1}</option>
            ))}
          </select>
          <select style={{ padding: "10px", borderRadius: "8px", marginRight: "10px", border: "1px solid #ccc" }} onChange={(e) => setPick(e.target.value)} value={pick}>
            <option value="">Select Team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.team_name}</option>
            ))}
          </select>
          <button style={{ backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "8px", border: "none" }} onClick={submitPick}>Submit Pick</button>
          {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}
        </div>
      )}

      <h3 style={{ color: "#4A2E12" }}>Submitted Picks</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff", borderRadius: "8px", overflow: "hidden" }}>
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

      {isLoggedIn && <button style={{ marginTop: "20px", backgroundColor: "#f4b942", padding: "10px 20px", borderRadius: "8px", border: "none" }} onClick={() => setIsLoggedIn(false)}>Logout</button>}
    </div>
  );
}
