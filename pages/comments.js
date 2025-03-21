// Updated /pages/comments.js to support threading and prevent null error

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function CommentsPage() {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, username, comment_text, created_at, parent_id")
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

    await supabase.from("comments").insert([
      {
        user_id: currentUser.id,
        username: currentUser.username,
        comment_text: newComment,
        parent_id: replyTo,
      },
    ]);
    setNewComment("");
    setReplyTo(null);
    fetchComments();
  };

  const fakeLogin = () => {
    setCurrentUser({ id: "demo-user-id", username: "DemoUser" });
    setIsLoggedIn(true);
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
          {isLoggedIn && (
            <button onClick={() => setReplyTo(comment.id)} style={{ fontSize: "12px" }}>
              Reply
            </button>
          )}
          {renderComments(comment.id, level + 1)}
        </div>
      ));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>Comment Board</h2>
      <div style={{ marginBottom: "15px" }}>
        {!isLoggedIn ? (
          <button onClick={fakeLogin}>Login to Comment</button>
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
