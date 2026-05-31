import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <main className="flex flex-col items-center justify-center gap-12 px-8 py-16">
        <div className="text-center">
          <h1 className="mb-4 text-6xl font-bold text-white drop-shadow-lg">
            🎮 Mini Games Hub
          </h1>
          <p className="text-xl text-purple-200">
            여러 게임을 한곳에서 즐겨보세요!
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* 도주 게임 카드 */}
          <Link href="/escape-game" aria-label="도주 게임 플레이하기">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 p-8 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-orange-500/50 cursor-pointer">
              <div aria-hidden="true" className="absolute -right-8 -top-8 text-9xl opacity-20">
                🚗
              </div>
              <div className="relative z-10">
                <h2 className="mb-3 text-3xl font-bold text-white">
                  도주 게임
                </h2>
                <p className="mb-4 text-white/90">
                  자동차를 조종해서 경찰차로부터 도주하세요!
                </p>
                <ul className="mb-6 space-y-2 text-sm text-white/80">
                  <li>✓ 2D 캔버스 게임</li>
                  <li>✓ 방향키로 조종</li>
                  <li>✓ 2-4인 경쟁 멀티플레이어</li>
                </ul>
                <div className="inline-block rounded-full bg-white/20 px-6 py-2 font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-white/30">
                  플레이하기 →
                </div>
              </div>
            </div>
          </Link>

          {/* 3D 서바이벌 게임 카드 */}
          <Link href="/survival-game" aria-label="3D 서바이벌 게임 플레이하기">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-teal-700 p-8 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-green-500/50 cursor-pointer">
              <div aria-hidden="true" className="absolute -right-8 -top-8 text-9xl opacity-20">
                🌍
              </div>
              <div className="relative z-10">
                <h2 className="mb-3 text-3xl font-bold text-white">
                  3D 서바이벌
                </h2>
                <p className="mb-4 text-white/90">
                  오픈 월드에서 생존하고 탐험하세요!
                </p>
                <ul className="mb-6 space-y-2 text-sm text-white/80">
                  <li>✓ 3D 오픈 월드</li>
                  <li>✓ 서바이벌 시스템</li>
                  <li>✓ 2-4인 협동 멀티플레이어</li>
                </ul>
                <div className="inline-block rounded-full bg-white/20 px-6 py-2 font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-white/30">
                  플레이하기 →
                </div>
              </div>
            </div>
          </Link>

          {/* 비행 게임 카드 */}
          <Link href="/flight-game" aria-label="Sky Explorer 비행 게임 플레이하기">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-700 p-8 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-cyan-500/50 cursor-pointer">
              <div aria-hidden="true" className="absolute -right-8 -top-8 text-9xl opacity-20">
                ✈️
              </div>
              <div className="relative z-10">
                <h2 className="mb-3 text-3xl font-bold text-white">
                  Sky Explorer
                </h2>
                <p className="mb-4 text-white/90">
                  실제 지구 위를 자유롭게 비행하세요!
                </p>
                <ul className="mb-6 space-y-2 text-sm text-white/80">
                  <li>✓ 3D 비행 시뮬레이터</li>
                  <li>✓ 실제 지구 위성 지도</li>
                  <li>✓ 6개 도시 · 3가지 비행 모드</li>
                </ul>
                <div className="inline-block rounded-full bg-white/20 px-6 py-2 font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-white/30">
                  플레이하기 →
                </div>
              </div>
            </div>
          </Link>

          {/* 사막 드라이빙 카드 */}
          <Link href="/desert-game" aria-label="Dust Drifter 사막 게임 플레이하기">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-700 p-8 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-orange-500/50 cursor-pointer">
              <div aria-hidden="true" className="absolute -right-8 -top-8 text-9xl opacity-20">
                🏜️
              </div>
              <div className="relative z-10">
                <h2 className="mb-3 text-3xl font-bold text-white">
                  Dust Drifter
                </h2>
                <p className="mb-4 text-white/90">
                  황혼의 사막을 자유롭게 누비세요!
                </p>
                <ul className="mb-6 space-y-2 text-sm text-white/80">
                  <li>✓ 3D 로우폴리 사막 오픈 월드</li>
                  <li>✓ 먼지 휘날리는 드리프트 · 빅에어</li>
                  <li>✓ 신기루 탐험 · 낮↔밤 순환</li>
                </ul>
                <div className="inline-block rounded-full bg-white/20 px-6 py-2 font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-white/30">
                  플레이하기 →
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-purple-300">
            Made with Next.js & Tailwind CSS
          </p>
        </div>
      </main>
    </div>
  );
}
