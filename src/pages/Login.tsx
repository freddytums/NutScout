import { useState } from 'react';
import { LogIn, Wifi, WifiOff } from 'lucide-react';
import { signInWithGoogle } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

export function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError('Sign-in failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-[hsl(var(--background))]">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-4">
          <img src="/NutScout/NUTRONs.png" alt="Nutrons 125" className="w-32 h-32 object-contain drop-shadow-lg" draggable={false} />
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-wider text-[hsl(var(--foreground))]">NUTSCOUT</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Nutrons 125 · FRC Scouting</p>
          </div>
        </div>

        {/* Offline indicator */}
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          {navigator.onLine ? (
            <><Wifi size={14} className="text-[hsl(var(--accent))]" /> Works offline after first sign-in</>
          ) : (
            <><WifiOff size={14} className="text-amber-400" /> You're offline — cached data available</>
          )}
        </div>

        {/* Auth options */}
        <div className="w-full flex flex-col gap-3">
          <Button
            variant="default"
            size="lg"
            className="w-full gap-3"
            onClick={handleGoogleLogin}
            loading={loading}
          >
            <LogIn size={18} />
            Continue with Google
          </Button>
        </div>

        {error && (
          <p className="text-sm text-[hsl(var(--destructive))] text-center" role="alert">
            {error}
          </p>
        )}

        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
          Sign in with your team's Google account.
          <br />Contact your scouting lead to get access.
        </p>
      </div>
    </div>
  );
}
