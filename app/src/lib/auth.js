import { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

// Only refresh tokens while the app is in the foreground (Supabase's React Native advice)
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

const AuthContext = createContext({ session: null, loading: true, linkError: null });

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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState(null);
  const url = Linking.useURL();

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
      .catch((error) => setLinkError(error.message));
  }, [url]);

  return (
    <AuthContext.Provider value={{ session, loading, linkError }}>
      {children}
    </AuthContext.Provider>
  );
}
