"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { signIn } from "next-auth/react";

type Step = "method" | "phone" | "email";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("method");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailRegister() {
    setError("");
    if (!form.name || !form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed.");
        return;
      }
      // Auto sign in and redirect to setup
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (result?.ok) router.push("/setup");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0A0E1A 0%, #0D1B2A 50%, #0A1628 100%)" }}>

      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #25D366, transparent)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #128C7E, transparent)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-2xl"
            style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
            💬
          </div>
          <h1 className="text-3xl font-bold text-white">AquaChat</h1>
          <p className="text-slate-400 text-sm mt-1">Create your account</p>
        </div>

        <div className="rounded-3xl border border-white/10 p-8 backdrop-blur-xl"
          style={{ background: "rgba(17,24,39,0.9)" }}>

          <AnimatePresence mode="wait">

            {/* Method Selection */}
            {step === "method" && (
              <motion.div key="method" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-xl font-bold text-white mb-6 text-center">How do you want to sign up?</h2>
                <div className="space-y-3">

                  {/* Phone */}
                  <button onClick={() => setStep("phone")}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-green-500/40 hover:bg-green-500/5 transition group">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: "rgba(37,211,102,0.15)" }}>
                      📱
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold">Continue with Phone</p>
                      <p className="text-slate-400 text-sm">Verify with OTP</p>
                    </div>
                    <svg className="w-5 h-5 text-slate-500 ml-auto group-hover:text-green-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Google */}
                  <button onClick={() => signIn("google", { callbackUrl: "/setup" })}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5 transition group">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: "rgba(66,133,244,0.15)" }}>
                      G
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold">Continue with Google</p>
                      <p className="text-slate-400 text-sm">Use your Google account</p>
                    </div>
                    <svg className="w-5 h-5 text-slate-500 ml-auto group-hover:text-blue-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Facebook */}
                  <button onClick={() => signIn("facebook", { callbackUrl: "/setup" })}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-blue-600/40 hover:bg-blue-600/5 transition group">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold text-blue-500 flex-shrink-0"
                      style={{ background: "rgba(24,119,242,0.15)" }}>
                      f
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold">Continue with Facebook</p>
                      <p className="text-slate-400 text-sm">Use your Facebook account</p>
                    </div>
                    <svg className="w-5 h-5 text-slate-500 ml-auto group-hover:text-blue-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Email */}
                  <button onClick={() => setStep("email")}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5 transition group">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: "rgba(139,92,246,0.15)" }}>
                      ✉️
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold">Continue with Email</p>
                      <p className="text-slate-400 text-sm">Register with email & password</p>
                    </div>
                    <svg className="w-5 h-5 text-slate-500 ml-auto group-hover:text-purple-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                <p className="text-center text-slate-500 text-sm mt-6">
                  Already have an account?{" "}
                  <Link href="/login" className="text-green-400 hover:text-green-300 font-medium">Sign in</Link>
                </p>
              </motion.div>
            )}

            {/* Phone Step */}
            {step === "phone" && (
              <motion.div key="phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={() => setStep("method")} className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm mb-6">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back
                </button>

                <h2 className="text-xl font-bold text-white mb-2">Enter your phone number</h2>
                <p className="text-slate-400 text-sm mb-6">We'll send you a verification code</p>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl mb-4">
                    {error}
                  </div>
                )}

                <div className="flex gap-2 mb-4">
                  <div className="flex items-center gap-2 px-3 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm flex-shrink-0">
                    🇿🇦 +27
                  </div>
                  <input
                    type="tel"
                    placeholder="81 234 5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition"
                  />
                </div>

                {otpSent && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <p className="text-slate-400 text-sm mb-2">Enter the 6-digit code sent to your phone</p>
                    <input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition text-center text-2xl tracking-widest mb-4"
                    />
                  </motion.div>
                )}

                <button
                  onClick={() => {
                    if (!otpSent) {
                      setOtpSent(true);
                    } else {
                      router.push("/setup");
                    }
                  }}
                  disabled={loading || !phone}
                  className="w-full py-3.5 rounded-xl font-semibold text-white transition disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
                >
                  {otpSent ? "Verify & Continue →" : "Send Code →"}
                </button>

                <p className="text-xs text-slate-500 text-center mt-3">
                  Standard SMS rates may apply
                </p>
              </motion.div>
            )}

            {/* Email Step */}
            {step === "email" && (
              <motion.div key="email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={() => setStep("method")} className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm mb-6">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back
                </button>

                <h2 className="text-xl font-bold text-white mb-6">Create your account</h2>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl mb-4">
                    {error}
                  </div>
                )}

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition placeholder-slate-500"
                  />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition placeholder-slate-500"
                  />
                  <input
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-green-500/50 transition placeholder-slate-500"
                  />
                </div>

                <button
                  onClick={handleEmailRegister}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-semibold text-white transition disabled:opacity-50 mt-4"
                  style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    "Create Account →"
                  )}
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}