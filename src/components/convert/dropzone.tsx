'use client';

import { useCallback, useId, useRef, useState } from 'react';

import { CloudUpload, FilePlus2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn, formatBytes } from '@/utils';

interface DropzoneProps {
  accept: string;
  maxFiles: number;
  maxFileBytes: number;
  disabled?: boolean;
  onFiles: (files: FileList | File[]) => void;
  /** Short description of what this converter accepts. */
  hint: string;
}

/**
 * Accessible drag-and-drop upload surface.
 *
 * The whole card is a labelled button so pointer, keyboard and screen-reader
 * users all reach the same file picker; drag events are counted rather than
 * toggled so dragging over a child element does not flicker the active state.
 */
export function Dropzone({
  accept,
  maxFiles,
  maxFileBytes,
  disabled = false,
  onFiles,
  hint,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const inputId = useId();

  const openPicker = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      if (disabled) return;

      const { files } = event.dataTransfer;
      if (files.length > 0) onFiles(files);
    },
    [disabled, onFiles],
  );

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        if (!disabled) setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
      onClick={(event) => {
        // The inner "browse" button handles its own click; ignore the bubble.
        if ((event.target as HTMLElement).closest('button')) return;
        openPicker();
      }}
      className={cn(
        'cursor-pointer',
        'relative overflow-hidden rounded-2xl border-2 border-dashed transition-colors',
        isDragging
          ? 'border-primary bg-accent'
          : 'border-border bg-card hover:border-primary/50',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      {/* A 1% lift on drag-over. Previously a Framer spring, now a CSS
          transition: it was the only reason this component — which renders on
          every prerendered landing page — pulled in the animation library, and
          `motion-safe` respects a reduced-motion preference the same way. */}
      <div
        className={cn(
          'flex flex-col items-center gap-4 px-6 py-12 text-center transition-transform duration-200 ease-out sm:py-16',
          isDragging && 'motion-safe:scale-[1.01]',
        )}
      >
        <span
          className={cn(
            'flex size-14 items-center justify-center rounded-2xl transition-colors',
            isDragging
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent text-primary',
          )}
        >
          {isDragging ? (
            <FilePlus2 className="size-7" aria-hidden="true" />
          ) : (
            <CloudUpload className="size-7" aria-hidden="true" />
          )}
        </span>

        <div className="space-y-1.5">
          <p className="text-lg font-semibold tracking-tight">
            {isDragging ? 'Drop to upload' : 'Drag and drop your files'}
          </p>
          <p className="text-sm text-muted-foreground">
            or{' '}
            <Button
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={openPicker}
              type="button"
            >
              browse from your device
            </Button>
          </p>
        </div>

        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          {hint} Up to {maxFiles} file{maxFiles === 1 ? '' : 's'} at once,{' '}
          {formatBytes(maxFileBytes, 0)} each.
        </p>
      </div>

      <label className="sr-only" htmlFor={inputId}>
        Choose files to convert
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple={maxFiles > 1}
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const { files } = event.target;
          if (files && files.length > 0) onFiles(files);
          // Reset so selecting the same file twice re-triggers the handler.
          event.target.value = '';
        }}
      />
    </div>
  );
}
