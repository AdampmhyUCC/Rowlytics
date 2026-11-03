// Prints failed Supabase calls to the Expo terminal (and the browser console on
// web) with where they happened, so problems can be traced from the logs.
// Uses console.log rather than console.error so expected failures (e.g. a wrong
// password) don't open the red error overlay. Never log passwords or tokens.
export function logError(where, error) {
  if (!error) return;
  // Supabase errors carry a code (e.g. PGRST116) plus optional details and hint
  const { code, message, details, hint } = error;
  const extra = [details, hint].filter(Boolean).join(' | ');
  console.log(`[error] ${where}${code ? ` (${code})` : ''}: ${message}${extra ? ` | ${extra}` : ''}`);
}
