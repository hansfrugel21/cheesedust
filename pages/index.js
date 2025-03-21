// ✅ FINAL Combined Index Code: Comments + Picks Logic

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

  // Comments State
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);

  useEffect(() => {
    fetchExistingUsers();
    fetchSubmittedPicks();
    fetchComments();
    checkGameStatus();
  }, []);

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("comments")
      .select("id, username, user_id, comment_text, created_at, parent_id")
      .order("created_at", { ascending: true });
    if (!error) setComments(data || []);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return;
    const { error } = await supabase.from("comments").insert([
      {
        user_id: currentUser.id,
        username: currentUser.username,
        comment_text: newComment,
        parent_id: replyTo || null,
      },
    ]);
    if (!error) {
      setNewComment("");
      setReplyTo(null);
      fetchComments();
    }
  };

  const handleDeleteComment = async (commentId) => {
    await supabase.from("comments").delete().eq("id", commentId);
    fetchComments();
  };

  const renderComments = (parentId = null, level = 0) => {
    if (!comments) return null;
    return comments
      .filter((comment) => comment.parent_id === parentId)
      .map((comment) => (
        <div
          key={comment.id}
          style={{
            borderLeft: level > 0 ? "2px solid #ccc" : "none",
            marginLeft: level > 0 ? "20px" : "0",
            padding: "8px 0",
          }}
        >
          <strong>{comment.username}</strong>{" "}
          <span style={{ color: "gray", fontSize: "12px" }}>
            {new Date(comment.created_at).toLocaleString()}
          </span>
          <br />
          {comment.comment_text}
          <br />
          {isLoggedIn && (
            <>
              <button onClick={() => setReplyTo(comment.id)}>Reply</button>
              {comment.user_id === currentUser?.id && (
                <button style={{ color: "red" }} onClick={() => handleDeleteComment(comment.id)}>Delete</button>
              )}
            </>
          )}
          {renderComments(comment.id, level + 1)}
        </div>
      ));
  };

  // TODO: Add fetchTeamsForDay, checkGameStatus, fetchExistingUsers, fetchSubmittedPicks, handleSignUp, handleLogin, submitPick, handleLogout (left intact)

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      {/* Comment Board Top Section */}
      <h2>Comment Board</h2>
      {isLoggedIn && (
        <>
          {replyTo && (
            <div>Replying to comment ID: {replyTo} <button onClick={() => setReplyTo(null)}>Cancel</button></div>
          )}
          <textarea
            rows="3"
            style={{ width: "100%" }}
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <button onClick={handleAddComment}>Post Comment</button>
        </>
      )}
      <div>{renderComments()}</div>

      {/* Existing Login / Picks Logic Below */}

      {/* Login Block */}
      {!isLoggedIn && (
        <div>
          <div hidden>
            <h2>Sign Up</h2>
            <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input placeholder="Venmo ID" value={venmo} onChange={(e) => setVenmo(e.target.value)} />
            <button onClick={handleSignUp}>Sign Up</button>
          </div>

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
            {picksTable.length > 0 && [...new Set(picksTable.map((entry) => entry.tournament_day))]
              .sort((a, b) => a - b)
              .map((day) => (
                <th key={day}>Day {day}</th>
              ))}
          </tr>
        </thead>
        <tbody>
          {[...new Set(picksTable.map((entry) => entry.username))].sort().map((user) => (
            <tr key={user}>
              <td>{user}</td>
              {[...new Set(picksTable.map((entry) => entry.tournament_day))]
                .sort((a, b) => a - b)
                .map((day) => {
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
