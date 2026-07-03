console.log("Supabase config loading...");
const SUPABASE_URL = 'https://btlmhieavrvkznkrqrrm.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0bG1oaWVhdnJ2a3pua3JxcnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTA0NjcsImV4cCI6MjA5ODU4NjQ2N30.cvcmBhLRzFobbvGc9ObQABOV43NlsOAlMW1Hxuppv0c'

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

window.supabaseClient = supabaseClient
console.log("Supabase client initialized:", window.supabaseClient);