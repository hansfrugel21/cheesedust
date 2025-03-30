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
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch initial data on page load
  useEffect(() => {
    // A wrapper function to ensure async behavior inside useEffect
    const fetchData = async () => {
      await fetchExistingUsers();
      await fetchComments();
      await fetchSubmittedPicks();
      checkGameStatus();
    };

    fetchData();
  }, []); // The empty dependency array ensures this runs once when the component mounts

  const checkGameStatus = () => {
    const firstGameTimes = {
      1: new Date("2025-03-20T12:00:00"),
      2: new Date("2025-03-21T12:00:00"),
      3: new Date("2025-03-22T12:10:00"),
      4: new Date("2025-03-23T12:10:00"),
      5: new Date("2025-03-27T12:10:00"),
      6: new Date("2025-03-28T12:00:00"),
      7: new Date("2025-03-29T18:10:00"),
      8: new Date("2025-03-30T14:20:00"),
    };
    const currentTime = new Date();
    const newGameStartedDays = {};
    Object.entries(firstGameTimes).forEach(([day, gameTime]) => {
      newGameStartedDays[day] = currentTime >= gameTime;
    });
    setGameStartedDays(newGameStartedDays);
  };

  const fetchExistingUsers = async () => {
    try {
      const { data } = await supabase.from("users").select("username, email");
      setExistingUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleLogin = async () => {
    setErrorMessage("");
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

  const fetchComments = async () => {
    try {
      const { data } = await supabase
        .from("comments")
        .select("id, username, comment_text, created_at, parent_id")
        .order("created_at", { ascending: true });
      setComments(data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleAddComment = async (parentId = null) => {
    if (!newComment.trim() || !currentUser) return;
    try {
      await supabase.from("comments").insert([
        { user_id: currentUser.id, username: currentUser.username, comment_text: newComment, parent_id: parentId }
      ]);
      setNewComment("");
      fetchComments();
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const fetchTeamsForDay = async () => {
    if (!tournamentDay) {
      setTeams([]);
      return;
    }
    try {
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
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };

  useEffect(() => {
    fetchTeamsForDay();
  }, [tournamentDay]);

  const fetchSubmittedPicks = async () => {
    try {
      const { data } = await supabase
        .from("picks")
        .select("username, tournament_day, team_id, created_at, teams(team_name)")
        .order("created_at", { ascending: false }); // Order by creation time, descending

      const latestPicks = {};

      // Store only the most recent pick for each user and tournament day
      data?.forEach((entry) => {
        const key = `${entry.username}-${entry.tournament_day}`;  // Unique key for user and tournament day
        if (!latestPicks[key] || new Date(entry.created_at) > new Date(latestPicks[key].created_at)) {
          latestPicks[key] = entry;
        }
      });

      setPicksTable(Object.values(latestPicks));  // Convert map to array and store it
    } catch (error) {
      console.error("Error fetching submitted picks:", error);
    }
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
    try {
      await supabase.from("picks").insert([
        {
          user_id: currentUser.id,
          username: currentUser.username,
          team_id: pick,
          tournament_day: parseInt(tournamentDay, 10),
          created_at: new Date().toISOString(),
        },
      ]);
      fetchSubmittedPicks();
    } catch (error) {
      console.error("Error submitting pick:", error);
    }
  };

  const uniqueUsers = [...new Set(picksTable.map((entry) => entry.username))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const days = [...new Set(picksTable.map((entry) => entry.tournament_day))]
    .sort((a, b) => a - b);

  return (
    <div style={{ background: "transparent", padding: "20px", fontFamily: "Arial, sans-serif", color: "#333" }}>
      {/* Add your remaining JSX, such as login form, comment form, and picks table */}
    </div>
  );
}
