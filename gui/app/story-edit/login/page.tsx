"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://macys-api-n6f3.onrender.com";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem("editor_token", data.token);
        router.push("/story-edit");
      } else {
        setError(data.detail || "Invalid password");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
            <Lock className="h-5 w-5 text-teal-600" />
          </div>
          <h1 className="font-serif text-xl font-semibold text-charcoal">
            Slide Editor Login
          </h1>
          <p className="mt-1 text-sm text-charcoal/55">
            Enter the password to edit the storyboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full rounded-md border border-charcoal/15 bg-white px-4 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
          />
          {error && (
            <p className="text-xs text-soft_red">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy || !password.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Login
          </button>
        </form>
      </div>
    </main>
  );
}
