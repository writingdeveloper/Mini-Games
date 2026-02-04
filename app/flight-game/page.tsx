import Link from "next/link";

export default function FlightGame() {
  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <Link
        href="/"
        className="absolute top-4 left-4 z-[1001] bg-black/70 hover:bg-black/90 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
        홈으로
      </Link>
      <iframe
        src="/flight-game/index.html"
        className="h-full w-full border-0"
        title="Sky Explorer - 3D Flight Game"
        allow="fullscreen"
      />
    </div>
  );
}
