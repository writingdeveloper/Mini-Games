"use client";

import { useState } from "react";
import { LoadingOverlay } from "@/app/_components/LoadingOverlay";

export default function MakimaSaysGame() {
  const [loading, setLoading] = useState(true);
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {loading && <LoadingOverlay />}
      <iframe
        src="/makima-says/index.html"
        className="h-full w-full border-0"
        title="마키마 says"
        allow="autoplay; fullscreen"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
