// Updated /pages/comments.js with Supabase Auth login (Option #2)

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function CommentsPage() {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchComments();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setCurrentUser(user);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, username, user_id, comment_text, created_at, parent_id")
      .order("created_at", { ascending: true });
    setComments(data || []);
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
        username: currentUser.user_metadata.username || "Anonymous",
        comment_text: newComment,
        parent_id: replyTo,
      },
    ]);

    if (error) {
      setErrorMessage("Error submitting comment");
      return;
    }

    setNewComment("");
    setReplyTo(null);
    fetchComments();
  };

  const handleDeleteComment = async (commentId) => {
    await supabase.from("comments").delete().eq("id", commentId);
    fetchComments();
  };

  const handleLogin = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setErrorMessage("Failed to send login email");
    }
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
      <div style={{ marginBottom: "15px" }}>
        {!currentUser ? (
          <div>
            <input
              type="email"
              placeholder="Enter your email"
              onBlur={(e) => handleLogin(e.target.value)}
              style={{ marginBottom: "10px", width: "300px" }}
            />
            <p style={{ fontSize: "12px" }}>You'll receive a login email link.</p>
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
      </div>

      {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}

      <div>{renderComments()}</div>
    </div>
  );
}
