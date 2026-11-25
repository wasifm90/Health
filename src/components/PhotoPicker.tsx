"use client";
import { useRef, useState } from "react";

/** Take a photo, pick from the library, choose a file, or drag and drop (desktop). */
export function PhotoPicker({ onFiles, multiple = false, label = "Add photo" }: { onFiles: (files: File[]) => void; multiple?: boolean; label?: string }) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handle = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
      className={`rounded-2xl border-2 border-dashed p-4 text-center transition ${drag ? "border-emerald-500 bg-emerald-50" : "border-neutral-300 bg-white"}`}
    >
      <p className="mb-3 text-sm text-neutral-600">{label}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primary" onClick={() => camera.current?.click()}>📷 Take photo</button>
        <button type="button" className="btn-secondary" onClick={() => library.current?.click()}>🖼️ Upload</button>
      </div>
      <p className="mt-2 hidden text-xs text-neutral-400 sm:block">or drag and drop an image here</p>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
      <input ref={library} type="file" accept="image/*,.heic,.heif" multiple={multiple} className="hidden" onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
