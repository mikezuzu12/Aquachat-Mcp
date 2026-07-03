"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    if (!form.email || !form.password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (result?.error) { setError("Invalid email or password."); return; }
      router.push("/chat");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0A0E1A 0%, #0D1B2A 100%)" }}>

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #25D366, transparent)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #128C7E, transparent)" }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-2xl"
            style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
            💬
          </div>
          <h1 className="text-3xl font-bold text-white">AquaChat</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to continue</p>
        </div>

        <div className="rounded-3xl border border-white/10 p-8" style={{ background: "rgba(17,24,39,0.9)" }}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <div className="space-y-3 mb-4">
            <input type="email" placeholder="Email address" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition placeholder-slate-500" />
            <input type="password" placeholder="Password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition placeholder-slate-500" />
          </div>

          <button onClick={handleLogin} disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold text-white transition disabled:opacity-50 mb-4"
            style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : "Sign in"}
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 text-slate-500" style={{ background: "rgba(17,24,39,0.9)" }}>or</span>
            </div>
          </div>

          <button onClick={() => signIn("google", { callbackUrl: "/chat" })}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition text-white text-sm font-medium mb-2">
            <span className="text-lg font-bold">G</span> Continue with Google
          </button>

          <p className="text-center text-slate-500 text-sm mt-4">
            Don't have an account?{" "}
            <Link href="/register" className="text-green-400 hover:text-green-300 font-medium">Sign up</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}