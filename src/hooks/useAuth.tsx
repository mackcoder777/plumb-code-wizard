import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

/**
 * Single auth state machine for the app.
 *
 * This was previously a bare hook. Because a bare hook owns its own state,
 * each of the five call sites ran its own getSession(), its own
 * onAuthStateChange subscription and its own user_roles query -- and
 * GoTrueClient emits INITIAL_SESSION once per subscription, so the admin
 * check ran roughly eight times per page load and again on every auth event.
 *
 * The cost was not only the duplicate requests. Five independent copies of
 * `loading` and `user` can disagree with each other mid-resolution, which is
 * the substrate the auth race lived on: one consumer could believe the
 * session was resolved while another still had user === null.
 */
const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAdminStatus = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();

        // A failed request is not the same as "not an admin", even though both
        // end up as isAdmin: false. Report it, so a real admin seeing the Access
        // Denied screen can tell a permissions answer from a broken one.
        if (error) {
          console.error(
            '[useAuth] admin check failed - treating as non-admin:',
            { status: error.code, message: error.message, details: error.details },
          );
        }

        if (!cancelled) setIsAdmin(!!data && !error);
      } catch (error) {
        console.error('[useAuth] admin check threw:', error);
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Memoised so consumers do not re-render on every provider render for an
  // unchanged auth state.
  const value = useMemo<AuthState>(
    () => ({ user, loading, isAdmin, signOut }),
    [user, loading, isAdmin, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Returns the shared auth state. Same shape the bare hook returned, so call
 * sites are unchanged.
 *
 * Throws when no provider is mounted rather than returning a default. A
 * default would render as "not logged in, not admin, finished loading" --
 * indistinguishable from a real signed-out session, and it would send every
 * consumer down the wrong branch silently. A missing provider should fail
 * loudly on first render instead.
 */
export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>. Wrap the app in App.tsx.');
  }
  return ctx;
};
