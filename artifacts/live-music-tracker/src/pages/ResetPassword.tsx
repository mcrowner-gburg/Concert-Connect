import { useState } from "react";
import { Link } from "wouter";
import { Disc3 } from "lucide-react";

export function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_20px_rgba(255,0,127,0.4)]">
            <Disc3 className="w-6 h-6 text-white" />
          </div>
          <span className="font-display text-2xl tracking-widest text-foreground">CONCERT CONNECT</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          {!token ? (
            <div className="text-center">
              <h1 className="font-display text-2xl tracking-wider text-foreground mb-4">INVALID LINK</h1>
              <p className="text-muted-foreground text-sm mb-6">This reset link is missing or invalid. Request a new one.</p>
              <Link href="/forgot-password" className="text-primary hover:underline font-medium text-sm">
                Request new link
              </Link>
            </div>
          ) : success ? (
            <div className="text-center">
              <h1 className="font-display text-2xl tracking-wider text-foreground mb-4">PASSWORD UPDATED</h1>
              <p className="text-muted-foreground text-sm mb-6">Your password has been reset. You can now sign in.</p>
              <Link href="/login" className="text-primary hover:underline font-medium text-sm">
                Sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl tracking-wider text-foreground mb-2">NEW PASSWORD</h1>
              <p className="text-sm text-muted-foreground mb-6">Choose a new password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">New password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Confirm password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Repeat your password"
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-display tracking-widest py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "SAVING..." : "SET NEW PASSWORD"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
