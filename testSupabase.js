import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rrunfqoudjakydurwguc.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJydW5mcW91ZGpha3lkdXJ3Z3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1MDYwMDIsImV4cCI6MjA1NjA4MjAwMn0.1ff1f0oR_atKv5xKf9TRdQV9pxAggnYBMwYnpbAXlkA";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabase() {
  const { data, error } = await supabase.from("teams").select("*");
  console.log("Data:", data);
  console.log("Error:", error);
}

testSupabase();


