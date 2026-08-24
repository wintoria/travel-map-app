"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Błędny e-mail lub hasło.");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ 
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-100 p-4">
      <div className="w-full max-w-md bg-base-200 rounded-2xl shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-primary mb-2">TravelMap</h1>
          <p className="text-base-content/70 font-medium">Zaloguj się, aby zaplanować podróż</p>
        </div>

        {error && (
          <div className="bg-error/10 text-error p-3 rounded-lg text-sm text-center mb-6 font-medium border border-error/30">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Twój e-mail"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3.5 bg-base-100 border border-base-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
          />
          <input
            type="password"
            placeholder="Hasło"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-3.5 bg-base-100 border border-base-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
          />
          <Button
            type="submit"
            disabled={loading}
            fullWidth
            className="p-3.5 rounded-xl shadow-md mt-2"
          >
            {loading ? "Logowanie..." : "Zaloguj się"}
          </Button>
        </form>

        <div className="mt-8 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-base-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-base-200 text-muted font-medium">lub</span>
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={handleGoogleLogin}
          fullWidth
          className="mt-8 gap-3 p-3.5 rounded-xl shadow-sm"
        >
          {/* Prosta ikonka G */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Kontynuuj z Google
        </Button>
      </div>
    </div>
  );
}