export default function SurvivalGame() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <iframe
        src="/survival-game/index.html"
        className="h-full w-full border-0"
        title="3D 서바이벌 게임"
      />
    </div>
  );
}
