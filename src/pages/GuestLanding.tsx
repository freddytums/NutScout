import { ShieldQuestion, Mail, Copy, Check, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuth, signOut } from '@/hooks/useAuth';

export function GuestLanding() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  async function copyEmail() {
    if (!user?.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — no-op
    }
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
          <ShieldQuestion size={36} className="text-amber-400" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] font-[Orbitron] tracking-wide">
            Awaiting Access
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">
            Your account has been created, but you don't have access yet.
            Please <span className="text-[hsl(var(--accent))] font-medium">contact your scouting lead or a mentor</span> to be granted access.
          </p>
        </div>

        <div className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--primary))] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full object-fill" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--accent)/0.2)] flex items-center justify-center text-lg font-bold text-[hsl(var(--accent))]">
                {user.displayName[0]}
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <div className="font-medium text-sm truncate">{user.displayName}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">{user.email}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-left">
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-semibold">
              Share this with your lead
            </p>
            <button
              type="button"
              onClick={copyEmail}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] hover:border-[hsl(var(--accent)/0.5)] text-xs cursor-pointer transition-colors text-left"
            >
              <Mail size={13} className="text-[hsl(var(--muted-foreground))] shrink-0" />
              <span className="font-data truncate flex-1">{user.email}</span>
              {copied ? (
                <span className="flex items-center gap-1 text-[hsl(var(--accent))] shrink-0">
                  <Check size={12} /> Copied
                </span>
              ) : (
                <Copy size={12} className="text-[hsl(var(--muted-foreground))] shrink-0" />
              )}
            </button>
          </div>
        </div>

        <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
          This page will refresh automatically once your role is upgraded — no need to sign in again.
        </p>

        <button
          type="button"
          onClick={() => signOut()}
          className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-pointer transition-colors"
        >
          <LogOut size={12} />
          Sign out
        </button>
      </div>
    </div>
  );
}
