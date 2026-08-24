"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { initSyncListener } from "@/lib/offline/sync";
import LoginScreen from "./LoginScreen";

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for an existing session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Register the offline mutation-queue sync listener only once a session is confirmed — the same
  // point the rest of the app is known-safe to make authenticated Supabase calls.
  useEffect(() => {
    if (session) initSyncListener();
  }, [session]);

  // Show a simple loading state while checking credentials
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-medium">Sprawdzanie dostępu...</p>
      </div>
    );
  }

  // If there's no session, block access and show the login screen
  if (!session) {
    return <LoginScreen />;
  }

  // If logged in, show the actual app
  return <>{children}</>;
}