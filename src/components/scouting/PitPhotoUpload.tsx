import { useRef, useState } from 'react';
import { Camera, X, Loader2, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PitPhoto } from '@/types/scout';

interface Props {
  photos: PitPhoto[];
  onChange: (photos: PitPhoto[]) => void;
  max?: number;
}

const DEFAULT_MAX = 6;
const MAX_FILE_SIZE = 25 * 1024 * 1024;   // 25MB raw upload cap
const TARGET_MAX_PX = 1024;                // longest edge after compression
const JPEG_QUALITY = 0.72;

/** Resize so the longest edge is ≤ maxPx, return a base64 JPEG data URL.
 *  Keeps photos small enough to live in Firestore (~80-150KB each). */
function compressToDataURL(file: File, maxPx = TARGET_MAX_PX, quality = JPEG_QUALITY): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const ratio = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

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
    img.src = url;
  });
}

export function PitPhotoUpload({ photos, onChange, max = DEFAULT_MAX }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atLimit = photos.length >= max;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = ''; // allow reselecting the same file
    if (files.length === 0) return;

    setError(null);
    const slotsLeft = max - photos.length;
    if (slotsLeft <= 0) {
      setError(`Max ${max} photos`);
      return;
    }
    const toProcess = files.slice(0, slotsLeft);
    if (files.length > slotsLeft) {
      setError(`Only added the first ${slotsLeft} — limit is ${max}`);
    }

    setUploading(true);
    try {
      const next: PitPhoto[] = [...photos];
      for (const file of toProcess) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > MAX_FILE_SIZE) {
          setError(`"${file.name}" is over 25MB — skipped`);
          continue;
        }
        try {
          const url = await compressToDataURL(file);
          next.push({ url });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          setError(`Failed: ${msg}`);
        }
      }
      onChange(next);
    } finally {
      setUploading(false);
    }
  }

  function removeAt(idx: number) {
    onChange(photos.filter((_, i) => i !== idx));
  }

  function setCaption(idx: number, caption: string) {
    onChange(photos.map((p, i) => (i === idx ? { ...p, caption } : p)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-[hsl(var(--muted-foreground))]">
          Photos <span className="font-data">({photos.length}/{max})</span>
        </label>
        {!atLimit && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs text-[hsl(var(--accent))] hover:underline cursor-pointer disabled:opacity-50"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
            {uploading ? 'Compressing…' : 'Add photo'}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={handleFiles}
        aria-label="Upload pit photos"
      />

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] cursor-pointer transition-colors',
            'hover:border-[hsl(var(--accent)/0.5)] hover:text-[hsl(var(--accent))] disabled:opacity-50',
          )}
        >
          {uploading ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <>
              <Camera size={24} />
              <span className="text-xs">Tap to add robot photos</span>
              <span className="text-[10px] opacity-70">Drivetrain · Shooter · Climber · etc.</span>
            </>
          )}
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {photos.map((p, i) => (
            <div
              key={i}
              className="relative rounded-lg overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--muted))] flex flex-col"
            >
              <div className="relative aspect-[4/3] bg-black">
                <img
                  src={p.url}
                  alt={p.caption || `Robot photo ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label="Remove photo"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 hover:bg-[hsl(var(--destructive))] text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
              <input
                type="text"
                value={p.caption ?? ''}
                onChange={(e) => setCaption(i, e.target.value)}
                placeholder="Caption (optional)"
                maxLength={60}
                className="h-7 px-2 text-[10px] bg-[hsl(var(--muted))] border-t border-[hsl(var(--border)/0.5)] focus:outline-none focus:bg-[hsl(var(--primary))]"
              />
            </div>
          ))}
          {!atLimit && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                'aspect-[4/3] rounded-lg border-2 border-dashed border-[hsl(var(--border))] flex flex-col items-center justify-center gap-1 text-[hsl(var(--muted-foreground))] cursor-pointer transition-colors',
                'hover:border-[hsl(var(--accent)/0.5)] hover:text-[hsl(var(--accent))] disabled:opacity-50',
              )}
            >
              {uploading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <ImagePlus size={20} />
                  <span className="text-[10px]">Add another</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-[11px] text-[hsl(var(--destructive))]" role="alert">{error}</p>
      )}
      {photos.length > 0 && !error && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Photos are compressed automatically before saving</p>
      )}
    </div>
  );
}
