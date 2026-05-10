import { useState, useRef } from 'react';
import { Camera, Save, Loader2, Search } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { storage, auth } from '@/lib/firebase';
import { updateUserProfile } from '@/lib/firestore';
import { getTeam } from '@/lib/tba';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function Profile() {
  const { user } = useAuth();
  const { setUser } = useAuthStore();
  const [name, setName] = useState(user?.displayName ?? '');
  const [teamNumber, setTeamNumber] = useState(String(user?.teamNumber ?? ''));
  const [teamName, setTeamName] = useState(user?.teamName ?? '');
  const [teamKey, setTeamKey] = useState(user?.teamKey ?? '');
  const [lookingUpTeam, setLookingUpTeam] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError('Photo must be under 5MB'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  }

  async function lookupTeam() {
    if (!teamNumber) return;
    setLookingUpTeam(true);
    setError(null);
    try {
      const team = await getTeam(parseInt(teamNumber));
      setTeamName(team.nickname || team.name);
      setTeamKey(team.key);
    } catch {
      setError('Team not found on TBA. You can still save your team number.');
    } finally {
      setLookingUpTeam(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    if (!name.trim()) { setError('Name cannot be empty'); return; }
    setSaving(true);
    setError(null);
    try {
      let photoURL = user.photoURL;
      if (file) {
        const storageRef = ref(storage, `photos/${user.uid}/avatar`);
        await uploadBytes(storageRef, file);
        photoURL = await getDownloadURL(storageRef);
      }

      const updates: Parameters<typeof updateUserProfile>[1] = {
        displayName: name.trim(),
        photoURL: photoURL ?? undefined,
      };
      if (teamNumber) {
        updates.teamNumber = parseInt(teamNumber);
        if (teamKey) updates.teamKey = teamKey;
        if (teamName) updates.teamName = teamName;
      }

      await updateUserProfile(user.uid, updates);

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: name.trim(),
          photoURL: photoURL ?? null,
        });
      }

      setUser({
        ...user,
        displayName: name.trim(),
        photoURL: photoURL ?? undefined,
        ...(teamNumber ? { teamNumber: parseInt(teamNumber), teamKey, teamName } : {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const avatarSrc = preview ?? user.photoURL;

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <h2 className="text-base font-semibold">My Profile</h2>

      <Card>
        <CardHeader><CardTitle>Photo & Name</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[hsl(var(--accent)/0.2)] flex items-center justify-center text-2xl font-bold text-[hsl(var(--accent))]">
                  {name[0] ?? '?'}
                </div>
              )}
              <button type="button" onClick={() => inputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center cursor-pointer shadow-lg" aria-label="Change photo">
                <Camera size={14} className="text-black" />
              </button>
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} aria-label="Upload profile photo" />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Tap the camera to upload a photo (max 5MB)</p>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[hsl(var(--muted-foreground))]">Display Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-base focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))]"
              placeholder="Your name" />
          </div>

          {/* Team number + TBA lookup */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[hsl(var(--muted-foreground))]">Team Number</label>
            <div className="flex gap-2">
              <input type="number" inputMode="numeric" value={teamNumber}
                onChange={(e) => { setTeamNumber(e.target.value); setTeamName(''); setTeamKey(''); }}
                className="flex-1 h-11 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 text-lg font-data focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))]"
                placeholder="e.g. 254" />
              <Button variant="secondary" size="icon" onClick={lookupTeam} loading={lookingUpTeam} disabled={!teamNumber} aria-label="Look up team on TBA">
                <Search size={16} />
              </Button>
            </div>
            {teamName && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-data">frc{teamNumber}</Badge>
                <span className="text-sm text-[hsl(var(--accent))]">{teamName}</span>
              </div>
            )}
            {!teamName && teamNumber && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Tap 🔍 to auto-fill team name from TBA</p>
            )}
          </div>

          {error && <p className="text-sm text-[hsl(var(--destructive))]" role="alert">{error}</p>}

          <Button onClick={handleSave} loading={saving} className="gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Role + team summary */}
      <Card>
        <CardContent className="pt-4 flex flex-col gap-1">
          <div className="text-sm font-medium">{user.displayName}</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{user.email}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="secondary">{user.role}</Badge>
            {user.teamKey && <Badge variant="outline" className="font-data">{user.teamKey}</Badge>}
            {user.teamName && <span className="text-xs text-[hsl(var(--muted-foreground))]">{user.teamName}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
