import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rrunfqoudjakydurwguc.supabase.co"; // Replace with your Supabase Project URL
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJydW5mcW91ZGpha3lkdXJ3Z3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1MDYwMDIsImV4cCI6MjA1NjA4MjAwMn0.1ff1f0oR_atKv5xKf9TRdQV9pxAggnYBMwYnpbAXlkA"; // Replace with your Supabase Anon Key

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

