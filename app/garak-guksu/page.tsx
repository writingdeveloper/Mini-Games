"use client";

import { useState } from "react";
import { LoadingOverlay } from "@/app/_components/LoadingOverlay";

export default function GarakGuksuGame() {
  const [loading, setLoading] = useState(true);
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {loading && <LoadingOverlay />}
      <iframe
        src="/garak-guksu/index.html"
        className="h-full w-full border-0"
        title="역전국수"
        allow="autoplay; fullscreen"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
