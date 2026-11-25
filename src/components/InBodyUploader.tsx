"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoPicker } from "@/components/PhotoPicker";
import { INBODY_FIELDS } from "@/components/InBodyFields";
import { createClient } from "@/lib/supabase/client";
import { postJson, prepareImage, type PreparedImage } from "@/lib/image";
import { localDateClient } from "@/components/dates";

type Extracted = Record<string, number | string | boolean | null>;

export function InBodyUploader() {
  const router = useRouter();
  const [photos, setPhotos] = useState<PreparedImage[]>([]);
  const [data, setData] = useState<Extracted | null>(null);
  const [scanDate, setScanDate] = useState(localDateClient());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onFiles(files: File[]) {
    setError(null);
    setDone(false);
    try {
      setBusy("Preparing photos…");
      const imgs = await Promise.all(files.slice(0, 4).map((f) => prepareImage(f, 2000, 0.9)));
      setPhotos(imgs);
      setBusy("Reading your InBody sheet…");
      const res = await postJson<Extracted>("/api/inbody/extract", { images: imgs.map((i) => ({ data: i.data, mediaType: i.mediaType })) });
      if (!res.is_inbody) {
        setError("This doesn't look like an InBody result. Try a clearer photo of the whole sheet.");
        return;
      }
      setData(res);
      if (typeof res.scan_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(res.scan_date)) setScanDate(res.scan_date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the sheet.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!data) return;
    setBusy("Saving…");
    setError(null);
    try {
      let photo_path: string | undefined;
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (u.user && photos[0]) {
        const path = `${u.user.id}/inbody/${Date.now()}.jpg`;
        const up = await supabase.storage.from("photos").upload(path, photos[0].blob, { contentType: "image/jpeg" });
        if (!up.error) photo_path = path;
      }
      await postJson("/api/inbody/save", { data, scan_date: scanDate, photo_path });
      setDone(true);
      setData(null);
      setPhotos([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {!data && <PhotoPicker multiple onFiles={onFiles} label="Photograph or upload your InBody result sheet (up to 4 photos)" />}
      {busy && <p className="card animate-pulse text-center text-sm text-neutral-600">{busy}</p>}
      {error && <p className="card bg-rose-50 text-sm text-rose-800">{error}</p>}
      {done && <p className="card bg-emerald-50 text-sm text-emerald-800">✅ Scan saved. Your targets and report now use it.</p>}

      {data && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Check the values</h2>
          <p className="text-sm text-neutral-500">Fix anything that was misread, then save.</p>
          {photos[0] && <img src={photos[0].previewUrl} alt="InBody sheet" className="max-h-48 w-full rounded-xl object-contain" />}
          <div>
            <label className="label">Scan date</label>
            <input className="input" type="date" value={scanDate} onChange={(e) => setScanDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {INBODY_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}{f.unit && ` (${f.unit})`}</label>
                <input className="input tabular-nums" type="number" inputMode="decimal" step="any"
                  value={data[f.key] === null || data[f.key] === undefined ? "" : String(data[f.key])}
                  onChange={(e) => setData({ ...data, [f.key]: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
            ))}
          </div>
          {typeof data.segmental_notes === "string" && data.segmental_notes && (
            <p className="text-sm text-neutral-600">{data.segmental_notes}</p>
          )}
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => { setData(null); setPhotos([]); }}>Cancel</button>
            <button className="btn-primary flex-[2]" onClick={save} disabled={!!busy}>Save scan</button>
          </div>
        </div>
      )}
    </div>
  );
}
