import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { logError } from './log';

// Only refresh tokens while the app is in the foreground (Supabase's React Native advice)
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

const AuthContext = createContext({
  session: null,
  loading: true,
  linkError: null,
  role: null,
  consentPending: null,
  refreshConsent: async () => null,
});

export function useAuth() {
  return useContext(AuthContext);
}

// Read params from both the query string and the #fragment of a deep link
function getUrlParams(url) {
  const params = {};
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  for (const part of [query, hash]) {
    new URLSearchParams(part).forEach((value, key) => { params[key] = value; });
  }
  return params;
}

// Email links (sign-up confirmation, password reset) open the app with tokens in the URL
async function createSessionFromUrl(url) {
  const params = getUrlParams(url);
  if (params.error_description) throw new Error(params.error_description);
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
  } else if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
  }
}

// The user's role, and whether they're an athlete under 16 still waiting for a
// parent. The database decides, and also blocks pending athletes itself; this
// only picks which screens to show.
async function fetchAccount(userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (error) throw error;
  if (profile.role !== 'athlete') return { role: profile.role, consentPending: false };
  const { data: active, error: rpcError } = await supabase.rpc('is_active_athlete');
  if (rpcError) throw rpcError;
  return { role: profile.role, consentPending: !active };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState(null);
  // null until checked for the signed-in user
  const [account, setAccount] = useState(null);
  const url = Linking.useURL();
  const userId = session?.user.id;

  // Returns the new value so callers can tell if the athlete is still pending
  const refreshConsent = useCallback(async () => {
    if (!userId) return null;
    try {
      const newAccount = await fetchAccount(userId);
      setAccount(newAccount);
      return newAccount.consentPending;
    } catch (error) {
      // Don't lock the user out over a network error; the database still enforces consent
      logError('auth.checkConsent', error);
      setAccount((current) => current ?? { role: null, consentPending: false });
      return null;
    }
  }, [userId]);

  // Check again for each new user, and whenever the app comes back to the
  // foreground (e.g. after the parent approves)
  useEffect(() => {
    setAccount(null);
    refreshConsent();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshConsent();
    });
    return () => subscription.remove();
  }, [refreshConsent]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!url) return;
    createSessionFromUrl(url)
      .then(() => setLinkError(null))
      .catch((error) => {
        logError('auth.emailLink', error);
        setLinkError(error.message);
      });
  }, [url]);

  return (
    <AuthContext.Provider value={{
      session,
      loading,
      linkError,
      role: account?.role ?? null,
      consentPending: account?.consentPending ?? null,
      refreshConsent,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
