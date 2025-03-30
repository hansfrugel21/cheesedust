useEffect(() => {
    fetchExistingUsers();
    fetchComments();
    checkGameStatus();
    fetchSubmittedPicks();
}, []);

// Fetch the most recent picks for each user and day
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

    console.log("Fetched Picks: ", latestPicks); // Debugging the fetched data
    setPicksTable(Object.values(latestPicks));
};

// Debug the data before rendering in the table
const debugPicks = () => {
  console.log("Picks Table: ", picksTable); // Log the picks table before rendering
};

const uniqueUsers = [...new Set(picksTable.map((entry) => entry.username))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

const days = [...new Set(picksTable.map((entry) => entry.tournament_day))]
    .sort((a, b) => a - b);

return (
    <div style={{ background: "transparent", padding: "20px", fontFamily: "Arial, sans-serif", color: "#333" }}>
      {/* Render comments and other UI elements */}
      
      <h2 style={{ borderBottom: "2px solid #f4b942", paddingBottom: "5px" }}>Submitted Picks</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff", border: "1px solid #ddd" }}>
        <thead>
          <tr style={{ backgroundColor: "#f4b942", color: "#fff" }}>
            <th style={{ padding: "10px", border: "1px solid #ddd" }}>Username</th>
            {days.map((day) => (
                <th key={day} style={{ padding: "10px", border: "1px solid #ddd" }}>Day {day}</th>
            ))}
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
                    {pickEntry ? pickEntry.teams.team_name : "No pick"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      
      {debugPicks()}  {/* Call debug function here */}
    </div>
);
