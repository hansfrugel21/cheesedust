import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';  // Ensure your supabaseClient is correctly configured

export default function Home() {
  // State variables for managing user login and picks
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [teams, setTeams] = useState([]);
  const [picksTable, setPicksTable] = useState([]);
  const [gameStartedDays, setGameStartedDays] = useState({});

  // State for handling comments
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  // Fetch existing users on initial load
  useEffect(() => {
    fetchExistingUsers();
    fetchComments();
    checkGameStatus();
  }, []);

  // Fetch all users for the login dropdown
  const fetchExistingUsers = async () => {
    try {
      const { data, error } = await supabase.from('users').select('username, email');
      if (error) throw error;
      setExistingUsers(data.sort((a, b) => a.username.localeCompare(b.username)));
    } catch (error) {
      setErrorMessage('Failed to fetch users');
      console.error('Error fetching users:', error);
    }
  };

  // Check game start status and update accordingly
  const checkGameStatus = () => {
    const firstGameTimes = {
      1: new Date('2025-03-20T12:00:00'),
      2: new Date('2025-03-21T12:00:00'),
      3: new Date('2025-03-22T12:10:00'),
    };
    const currentTime = new Date();
    const newGameStartedDays = {};
    Object.entries(firstGameTimes).forEach(([day, gameTime]) => {
      newGameStartedDays[day] = currentTime >= gameTime;
    });
    setGameStartedDays(newGameStartedDays);
  };

  // Handle user login logic
  const handleLogin = async () => {
    try {
      setErrorMessage('');
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, email')
        .eq('username', username)
        .eq('email', email)
        .single();

      if (error || !user) {
        setErrorMessage('User not found or email mismatch');
        return;
      }
      setCurrentUser(user);
      setIsLoggedIn(true);
      fetchSubmittedPicks();
    } catch (error) {
      setErrorMessage('Failed to login');
      console.error('Login error:', error);
    }
  };

  // Fetch comments from the database
  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('id, username, comment_text, created_at, parent_id')
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  // Submit a new comment to the database
  const handleAddComment = async (parentId = null) => {
    if (!newComment.trim() || !currentUser) return;
    try {
      await supabase.from('comments').insert([
        { user_id: currentUser.id, username: currentUser.username, comment_text: newComment, parent_id: parentId },
      ]);
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  // Render threaded comments
  const renderComments = (parentId = null, level = 0) => {
    return comments
      .filter(comment => comment.parent_id === parentId)
      .map(comment => (
        <div key={comment.id} style={{ marginLeft: level * 20, padding: '10px', background: '#fff', borderRadius: '8px', marginBottom: '10px', border: '1px solid #ddd' }}>
          <b>{comment.username}</b>: {comment.comment_text}
          <div style={{ fontSize: '12px', color: 'gray' }}>{new Date(comment.created_at).toLocaleString()}</div>
          {isLoggedIn && (
            <button style={{ marginTop: '5px', fontSize: '12px' }} onClick={() => handleAddComment(comment.id)}>Reply</button>
          )}
          {renderComments(comment.id, level + 1)}
        </div>
      ));
  };

  // Fetch teams for the selected day
  const fetchTeamsForDay = async () => {
    if (!tournamentDay) {
      setTeams([]);
      return;
    }
    try {
      const { data: scheduleData } = await supabase
        .from('team_schedule')
        .select('team_id')
        .eq('tournament_day', tournamentDay);

      if (scheduleData?.length) {
        const teamIds = scheduleData.map((entry) => entry.team_id);
        const { data: teamData } = await supabase
          .from('teams')
          .select('id, team_name')
          .in('id', teamIds);
        setTeams(teamData.sort((a, b) => a.team_name.localeCompare(b.team_name, undefined, { sensitivity: 'base' })));
      } else {
        setTeams([]);
      }
    } catch (error) {
      console.error('Error fetching teams for day:', error);
    }
  };

  // Fetch the submitted picks from users
  const fetchSubmittedPicks = async () => {
    try {
      const { data } = await supabase
        .from('picks')
        .select('username, tournament_day, team_id, date, teams(team_name)')
        .order('date', { ascending: false });

      const latestPicks = {};
      data?.forEach((entry) => {
        const key = `${entry.username}-${entry.tournament_day}`;
        if (!latestPicks[key]) {
          latestPicks[key] = entry;
        }
      });
      setPicksTable(Object.values(latestPicks));
    } catch (error) {
      console.error('Error fetching submitted picks:', error);
    }
  };

  // Submit the user pick for a specific day
  const submitPick = async () => {
    setErrorMessage('');
    if (!pick || !tournamentDay) {
      setErrorMessage('Please select a team and day.');
      return;
    }
    if (gameStartedDays[tournamentDay]) {
      setErrorMessage('Pick submission closed for this day.');
      return;
    }
    try {
      await supabase.from('picks').insert([
        {
          user_id: currentUser.id,
          username: currentUser.username,
          team_id: pick,
          tournament_day: parseInt(tournamentDay, 10),
          date: new Date().toISOString(),
        },
      ]);
      fetchSubmittedPicks();
    } catch (error) {
      console.error('Error submitting pick:', error);
    }
  };

  // Define unique users based on submitted picks
  const uniqueUsers = [...new Set(picksTable.map((entry) => entry.username))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  // Get the days for which picks are submitted
  const days = [...new Set(picksTable.map((entry) => entry.tournament_day))]
    .sort((a, b) => a - b);

  return (
    <div style={{ background: 'transparent', padding: '20px', fontFamily: 'Arial, sans-serif', color: '#333' }}>
      {/* Render User Login Section */}
      {!isLoggedIn && (
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#444' }}>Login to Submit Picks and Comment</h3>
          <select style={{ padding: '10px', borderRadius: '5px', marginBottom: '10px' }} onChange={(e) => setUsername(e.target.value)}>
            <option value="">Select user</option>
            {existingUsers.map((user) => (
              <option key={user.username} value={user.username}>{user.username}</option>
            ))}
          </select><br />
          <input style={{ padding: '10px', width: '250px', borderRadius: '5px', marginBottom: '10px' }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><br />
          <button style={{ backgroundColor: '#f4b942', padding: '10px 20px', borderRadius: '5px', border: 'none' }} onClick={handleLogin}>Login</button>
          {errorMessage && <div style={{ color: 'red', marginTop: '10px' }}>{errorMessage}</div>}
        </div>
      )}

      {/* Comments Section */}
      <h2 style={{ borderBottom: '2px solid #f4b942', paddingBottom: '5px' }}>Comments</h2>
      <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
        {renderComments()}
      </div>

      {/* Pick Submission Section */}
      {isLoggedIn && (
        <div style={{ marginBottom: '30px' }}>
          <textarea rows="3" style={{ width: '100%', padding: '10px', borderRadius: '8px' }} placeholder="Write a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
          <button style={{ backgroundColor: '#f4b942', padding: '10px 20px', borderRadius: '5px', border: 'none', marginTop: '10px' }} onClick={() => handleAddComment(null)}>Post Comment</button>
        </div>
      )}

      {/* Picks Table */}
      <h2 style={{ borderBottom: '2px solid #f4b942', paddingBottom: '5px' }}>Submitted Picks</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', border: '1px solid #ddd' }}>
        <thead>
          <tr style={{ backgroundColor: '#f4b942', color: '#fff' }}>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Username</th>
            {days.map((day) => (<th key={day} style={{ padding: '10px', border: '1px solid #ddd' }}>Day {day}</th>))}
          </tr>
        </thead>
        <tbody>
          {uniqueUsers.map((user, idx) => (
            <tr key={user} style={{ backgroundColor: idx % 2 === 0 ? '#fdf5e6' : '#fff' }}>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{user}</td>
              {days.map((day) => {
                const pickEntry = picksTable.find(
                  (entry) => entry.username === user && entry.tournament_day === day
                );
                return (
                  <td style={{ padding: '10px', border: '1px solid #ddd' }} key={day}>
                    {pickEntry ? (
                      (gameStartedDays[day] || (isLoggedIn && currentUser?.username === user))
                        ? pickEntry.teams.team_name
                        : 'Submitted'
                    ) : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Logout Button */}
      {isLoggedIn && <button style={{ marginTop: '20px', backgroundColor: '#f4b942', padding: '10px 20px', borderRadius: '5px', border: 'none' }} onClick={() => setIsLoggedIn(false)}>Logout</button>}
    </div>
  );
}
