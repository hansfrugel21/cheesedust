// Updated /pages/comments.js with username dropdown, proper user_id handling, and error logging

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function CommentsPage() {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [existingUsers, setExistingUsers] = useState([]);

  useEffect(() => {
    fetchComments();
    fetchExistingUsers();
  }, []);

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from("comments")
      .select("id, username, user_id, comment_text, created_at, parent_id")
      .order("created_at", { ascending: true });
    if (error) console.error("Fetch Comments Error:", error);
    setComments(data || []);
  };

  const fetchExistingUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("username")
      .order("username", { ascending: true });
    if (!error) setExistingUsers(data || []);
  };

  const handleAddComment = async () => {
    setErrorMessage("");
    if (!newComment.trim()) return;
    if (!currentUser) {
      setErrorMessage("You must be logged in to comment.");
      return;
    }

    const { error } = await supabase.from("comments").insert([
      {
        user_id: currentUser.id,
        username: currentUser.username,
        comment_text: newComment,
        parent_id: replyTo || null,
      },
    ]);

    if (error) {
      console.error("Insert Comment Error:", error);
      setErrorMessage("Error submitting comment");
      return;
    }

    setNewComment("");
    setReplyTo(null);
    fetchComments();
  };

  const handleDeleteComment = async (commentId) => {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) console.error("Delete Error:", error);
    fetchComments();
  };

  const handleLogin = async () => {
    setErrorMessage("");
    if (!loginUsername || !loginEmail) {
      setErrorMessage("Please select a username and enter an email.");
      return;
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username")
      .eq("username", loginUsername)
      .eq("email", loginEmail)
      .single();

    if (error || !user) {
      console.error("Login Error:", error);
      setErrorMessage("User not found or email mismatch.");
      return;
    }

    setCurrentUser(user);
  };

  const renderComments = (parentId = null, level = 0) => {
    if (!comments || comments.length === 0) return null;

    return comments
      .filter((comment) => comment.parent_id === parentId)
      .map((comment) => (
        <div
          key={comment.id}
          style={{
            borderLeft: level > 0 ? "2px solid #ccc" : "none",
            marginLeft: level > 0 ? "20px" : "0",
            padding: "8px 0",
            fontFamily: "Arial",
          }}
        >
          <strong>{comment.username}</strong>{" "}
          <span style={{ color: "gray", fontSize: "12px" }}>
            {new Date(comment.created_at).toLocaleString()}
          </span>
          <br />
          {comment.comment_text}
          <br />
          {currentUser && (
            <>
              <button
                onClick={() => setReplyTo(comment.id)}
                style={{ fontSize: "12px", marginRight: "10px" }}
              >
                Reply
              </button>
              {comment.user_id === currentUser.id && (
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  style={{ fontSize: "12px", color: "red" }}
                >
                  Delete
                </button>
              )}
            </>
          )}
          {renderComments(comment.id, level + 1)}
        </div>
      ));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>Comment Board</h2>

      {!currentUser ? (
        <div style={{ marginBottom: "15px" }}>
          <select
            onChange={(e) => setLoginUsername(e.target.value)}
            value={loginUsername}
            style={{ marginBottom: "10px", width: "300px" }}
          >
            <option value="">Select Username</option>
            {existingUsers.map((user) => (
              <option key={user.username} value={user.username}>
                {user.username}
              </option>
            ))}
          </select>
          <input
            type="email"
            placeholder="Email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            style={{ marginBottom: "10px", width: "300px" }}
          />
          <button onClick={handleLogin}>Login</button>
        </div>
      ) : (
        <>
          {replyTo && (
            <div style={{ marginBottom: "8px" }}>
              Replying to comment ID: {replyTo}{" "}
              <button onClick={() => setReplyTo(null)}>Cancel</button>
            </div>
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

      {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}

      <div>{renderComments()}</div>
    </div>
  );
}
