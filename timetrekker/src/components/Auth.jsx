import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.1-5.1l-6.5-5.5C29.6 35.4 26.9 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.5 5.5C41.6 35.4 44 30.1 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

export default function Auth() {
  const [mode, setMode] = useState("signup"); // "signup" | "login"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    if (!email.trim() || !password) return;
    if (mode === "signup") {
      if (password.length < 8) {
        setStatus("error");
        setErrorMsg("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setStatus("error");
        setErrorMsg("Passwords don't match.");
        return;
      }
    }
    setStatus("sending");
    setErrorMsg("");

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
      } else if (data.session) {
        // Email confirmation is disabled in Supabase -> signed in immediately
        setStatus("idle");
      } else {
        // Email confirmation required -> one link to click, then password login works forever after
        setStatus("sent");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
      } else {
        setStatus("idle");
      }
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-purple-800 flex flex-col items-center px-6 pt-24">
      <h1 className="text-5xl font-black text-black mb-12 tracking-tight">Timetrekker</h1>

      {status === "sent" ? (
        <div className="text-center max-w-sm">
          <h2 className="text-2xl font-bold text-black mb-2">Check your email</h2>
          <p className="text-black/70">
            We sent a confirmation link to <span className="font-semibold">{email}</span>. Click it once to activate your
            account — after that, you can log in directly with your email and password, no email needed.
          </p>
        </div>
      ) : (
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-black mb-1 text-center">
            {mode === "signup" ? "Create an account" : "Welcome back"}
          </h2>
          <p className="text-black/70 mb-6 text-center">
            {mode === "signup" ? "Enter your email and a password to sign up" : "Log in with your email and password"}
          </p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@domain.com"
            className="w-full bg-white rounded-2xl px-5 py-4 text-lg mb-3 outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min. 8 characters)"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="w-full bg-white rounded-2xl px-5 py-4 text-lg mb-3 outline-none"
          />
          {mode === "signup" && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              className="w-full bg-white rounded-2xl px-5 py-4 text-lg mb-4 outline-none"
            />
          )}

          {status === "error" && <p className="text-sm text-red-900 bg-red-200 rounded-xl px-4 py-2 mb-4">{errorMsg}</p>}

          <button
            onClick={handleSubmit}
            disabled={status === "sending" || !email.trim() || !password}
            className="w-full bg-black text-white rounded-2xl py-4 font-semibold text-lg mb-4 disabled:opacity-50"
          >
            {status === "sending" ? "Please wait..." : mode === "signup" ? "Sign up with email" : "Log in"}
          </button>

          <button
            onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setStatus("idle"); setErrorMsg(""); setConfirmPassword(""); }}
            className="w-full text-center text-sm text-black/80 mb-6 underline"
          >
            {mode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
          </button>

          <div className="flex items-center gap-3 w-full mb-6">
            <div className="flex-1 h-px bg-white/40" />
            <span className="text-white/80 text-sm">or continue with</span>
            <div className="flex-1 h-px bg-white/40" />
          </div>

          <button
            onClick={handleGoogle}
            className="w-full bg-neutral-200 rounded-2xl py-4 font-semibold flex items-center justify-center gap-3 mb-6"
          >
            <GoogleIcon />
            Google
          </button>

          <p className="text-xs text-black/60 text-center leading-relaxed">
            By clicking continue, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      )}
    </div>
  );
}
