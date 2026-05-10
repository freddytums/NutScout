import { useRef, useEffect, useState, useCallback } from 'react';
import { Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GameField } from '@/types/game';

export interface PathPoint {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  action?: string; // optional label (e.g. "pickup", "score")
}

export interface PathSegment {
  points: PathPoint[];
  color: string;
}

interface Props {
  field: GameField;
  value: PathSegment[];
  onChange: (v: PathSegment[]) => void;
  fieldImageSrc?: string;
}

const STROKE_COLORS = ['#22C55E', '#F59E0B', '#3B82F6', '#EF4444', '#A855F7'];

export function PathTracerField({ field, value, onChange, fieldImageSrc }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<PathPoint[]>([]);
  const colorIndex = value.length % STROKE_COLORS.length;
  const currentColor = STROKE_COLORS[colorIndex];

  const getCanvasPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>): PathPoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawSegment = (points: PathPoint[], color: string, alpha = 1) => {
      if (points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
      }
      ctx.stroke();

      // Draw start arrow
      const start = points[0];
      ctx.beginPath();
      ctx.arc(start.x * canvas.width, start.y * canvas.height, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    value.forEach((seg) => drawSegment(seg.points, seg.color));
    if (currentPoints.length > 1) {
      drawSegment(currentPoints, currentColor, 0.7);
    }
  }, [value, currentPoints, currentColor]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setCurrentPoints([getCanvasPoint(e)]);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setCurrentPoints((prev) => [...prev, getCanvasPoint(e)]);
  };

  const onPointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPoints.length > 3) {
      onChange([...value, { points: currentPoints, color: currentColor }]);
    }
    setCurrentPoints([]);
  };

  const undo = () => {
    onChange(value.slice(0, -1));
  };

  const clear = () => {
    onChange([]);
  };

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{field.label}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={undo} disabled={value.length === 0} aria-label="Undo last path">
            <Undo2 size={14} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={clear} disabled={value.length === 0} aria-label="Clear all paths">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--muted))] aspect-[54.75/26.33]"
        style={{ touchAction: 'none' }}
      >
        {fieldImageSrc && (
          <img
            src={fieldImageSrc}
            alt="FRC Field"
            className="absolute inset-0 w-full h-full object-fill opacity-60"
            draggable={false}
          />
        )}
        {!fieldImageSrc && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[hsl(var(--muted-foreground))]">
            Field image not configured
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={548}
          height={264}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          aria-label="Draw autonomous path"
          role="img"
        />
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Draw the robot's autonomous path. Each stroke is a separate segment.
        {value.length > 0 && ` (${value.length} segment${value.length === 1 ? '' : 's'})`}
      </p>
    </div>
  );
}
