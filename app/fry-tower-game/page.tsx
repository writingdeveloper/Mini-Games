"use client";

import { useState } from "react";
import Link from "next/link";
import { LoadingOverlay } from "@/app/_components/LoadingOverlay";

export default function FryTowerGame() {
  const [loading, setLoading] = useState(true);
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Link
        href="/"
        className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg bg-black/70 px-4 py-2 text-white transition-colors hover:bg-black/90"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
        홈으로
      </Link>
      {loading && <LoadingOverlay />}
      <iframe
        src="/fry-tower-game/index.html"
        className="h-full w-full border-0"
        title="Fryffel Tower - 감자튀김 마천루"
        allow="fullscreen"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
