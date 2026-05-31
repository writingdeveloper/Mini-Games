export function LoadingOverlay({ label = "게임 로딩 중..." }: { label?: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/80"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/25 border-t-white" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}
