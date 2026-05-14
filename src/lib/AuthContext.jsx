import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { CRM_APP_SLUG, TBL } from '@/api/entityApi';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    let mounted = true;

    const hydrateUser = async (session) => {
      if (!session?.user) {
        if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
        return;
      }
      const { data: profile } = await supabase
        .from(TBL.profiles)
        .select('*')
        .eq('id', session.user.id)
        .eq('app_slug', CRM_APP_SLUG)
        .maybeSingle();
      if (!mounted) return;
      if (!profile) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError('Tu usuario no está habilitado para CRM Inmobiliario');
        return;
      }
      setUser({
        id: session.user.id,
        email: session.user.email,
        full_name: profile?.full_name,
        isPlatformAdmin: profile?.is_platform_admin ?? false,
        consulta_follow_up_days: profile?.consulta_follow_up_days,
        postventa_follow_up_days: profile?.postventa_follow_up_days,
        googleCalendarEmail: profile?.google_calendar_email ?? null,
        googleCalendarLinkedAt: profile?.google_calendar_linked_at ?? null,
      });
      setIsAuthenticated(true);
      setAuthError(null);
    };

    const init = async () => {
      setIsLoadingAuth(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await hydrateUser(session);
      if (mounted) setIsLoadingAuth(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateUser(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    await supabase.auth.signOut();
    if (shouldRedirect) window.location.href = '/Login';
  };

  const navigateToLogin = () => {
    window.location.href = '/Login';
  };

  const checkAppState = async () => {
    setIsLoadingAuth(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from(TBL.profiles)
        .select('*')
        .eq('id', session.user.id)
        .eq('app_slug', CRM_APP_SLUG)
        .maybeSingle();
      if (!profile) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError('Tu usuario no está habilitado para CRM Inmobiliario');
        setIsLoadingAuth(false);
        return;
      }
      setUser({
        id: session.user.id,
        email: session.user.email,
        full_name: profile?.full_name,
        isPlatformAdmin: profile?.is_platform_admin ?? false,
        consulta_follow_up_days: profile?.consulta_follow_up_days,
        postventa_follow_up_days: profile?.postventa_follow_up_days,
        googleCalendarEmail: profile?.google_calendar_email ?? null,
        googleCalendarLinkedAt: profile?.google_calendar_linked_at ?? null,
      });
      setIsAuthenticated(true);
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
    setIsLoadingAuth(false);
  };

  const refreshProfile = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data: profile } = await supabase
      .from(TBL.profiles)
      .select('*')
      .eq('id', session.user.id)
      .eq('app_slug', CRM_APP_SLUG)
      .maybeSingle();
    if (!profile) return;
    setUser({
      id: session.user.id,
      email: session.user.email,
      full_name: profile?.full_name,
      isPlatformAdmin: profile?.is_platform_admin ?? false,
      consulta_follow_up_days: profile?.consulta_follow_up_days,
      postventa_follow_up_days: profile?.postventa_follow_up_days,
      googleCalendarEmail: profile?.google_calendar_email ?? null,
      googleCalendarLinkedAt: profile?.google_calendar_linked_at ?? null,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
