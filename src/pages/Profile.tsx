import { useState, useRef } from 'react';
import { Camera, Save, Search } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { updateUserProfile } from '@/lib/firestore';
import { getTeam } from '@/lib/tba';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/** Resize + center-crop to maxPx × maxPx, return as base64 JPEG data URL.
 *  No Firebase Storage needed — stored directly in Firestore (~20KB). */
function compressToDataURL(file: File, maxPx = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height, maxPx);
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }

        // White background so transparency renders correctly as JPEG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);

        const sw = img.naturalWidth || img.width;
        const sh = img.naturalHeight || img.height;
        ctx.drawImage(img, (sw - size) / 2, (sh - size) / 2, size, size, 0, 0, size, size);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl === 'data:,') { reject(new Error('Canvas produced empty output')); return; }
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image failed to load')); };
    // Must set crossOrigin before src for object URLs (even local ones on some browsers)
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'compressing' | 'saving' | 'done'>('idle');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const isSaving = saveStatus !== 'idle' && saveStatus !== 'done';

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { setError('Photo must be under 20MB'); return; }
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
    setError(null);
    setSaved(false);
    try {
      let photoURL = user.photoURL;

      if (file) {
        // Compress + convert to base64 — stored directly in Firestore, no Storage needed
        setSaveStatus('compressing');
        photoURL = await compressToDataURL(file, 256, 0.85);
      }

      setSaveStatus('saving');
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

      setSaveStatus('done');
      setSaved(true);
      setFile(null);
      setTimeout(() => { setSaved(false); setSaveStatus('idle'); }, 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(`Save failed: ${msg}`);
      setSaveStatus('idle');
    }
  }

  const avatarSrc = preview ?? user.photoURL;

  const saveLabel =
    saveStatus === 'compressing' ? 'Compressing…' :
    saveStatus === 'saving'      ? 'Saving…' :
    saved                        ? 'Saved!' :
    'Save Changes';

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
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center cursor-pointer shadow-lg"
                aria-label="Change photo">
                <Camera size={14} className="text-black" />
              </button>
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="sr-only"
              onChange={handleFileChange} aria-label="Upload profile photo" />

            {file && saveStatus === 'idle' && (
              <p className="text-xs text-[hsl(var(--accent))]">Photo selected — tap Save to upload</p>
            )}
            {!file && saveStatus === 'idle' && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Photos are compressed automatically before upload</p>
            )}
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
              <Button variant="secondary" size="icon" onClick={lookupTeam} loading={lookingUpTeam}
                disabled={!teamNumber} aria-label="Look up team on TBA">
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

          <Button onClick={handleSave} loading={isSaving} className="gap-2">
            <Save size={16} />
            {saveLabel}
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
