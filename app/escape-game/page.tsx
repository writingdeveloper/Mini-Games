export default function EscapeGame() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <iframe
        src="/escape-game/index.html"
        className="h-full w-full border-0"
        title="도주 게임"
      />
    </div>
  );
}
