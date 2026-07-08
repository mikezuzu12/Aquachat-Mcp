"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Gif = { id: string; preview: string; full: string; title: string };

export default function GifPicker({
  onSelect,
  onClose,
}: {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/giphy/search?q=${encodeURIComponent(q)}&limit=24`);
      const data = await res.json();
      setGifs(data.gifs || []);
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(""); // trending on open
  }, [search]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 w-80 h-96 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col z-50"
      style={{ background: "#1a2332" }}
    >
      <div className="p-2 border-b border-white/8">
        <input
          autoFocus
          type="text"
          placeholder="Search GIFs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none text-white placeholder-slate-500"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : gifs.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-8">No GIFs found</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((g) => (
              <button
                key={g.id}
                onClick={() => onSelect(g.full)}
                className="rounded-lg overflow-hidden hover:opacity-80 transition"
              >
                <img src={g.preview} alt={g.title} className="w-full h-24 object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}