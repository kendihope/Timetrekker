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
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleEmailSignup = async () => {
    if (!email.trim()) return;
    setStatus("sending");
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
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
            We sent a sign-in link to <span className="font-semibold">{email}</span>. Open it on this device to finish signing up —
            you won't need to sign in again after that.
          </p>
        </div>
      ) : (
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-black mb-1 text-center">Create an account</h2>
          <p className="text-black/70 mb-6 text-center">Enter your email to sign up</p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@domain.com"
            className="w-full bg-white rounded-2xl px-5 py-4 text-lg mb-4 outline-none"
          />

          {status === "error" && <p className="text-sm text-red-900 bg-red-200 rounded-xl px-4 py-2 mb-4">{errorMsg}</p>}

          <button
            onClick={handleEmailSignup}
            disabled={status === "sending" || !email.trim()}
            className="w-full bg-black text-white rounded-2xl py-4 font-semibold text-lg mb-6 disabled:opacity-50"
          >
            {status === "sending" ? "Sending..." : "Sign up with email"}
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
