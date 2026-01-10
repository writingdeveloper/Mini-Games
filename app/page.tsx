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

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-2">
          {/* 도주 게임 카드 */}
          <Link href="/escape-game">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 p-8 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-orange-500/50 cursor-pointer">
              <div className="absolute -right-8 -top-8 text-9xl opacity-20">
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
                  <li>✓ 점수 시스템</li>
                </ul>
                <div className="inline-block rounded-full bg-white/20 px-6 py-2 font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-white/30">
                  플레이하기 →
                </div>
              </div>
            </div>
          </Link>

          {/* 3D 서바이벌 게임 카드 */}
          <Link href="/survival-game">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 to-teal-700 p-8 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-green-500/50 cursor-pointer">
              <div className="absolute -right-8 -top-8 text-9xl opacity-20">
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
                  <li>✓ 캐릭터 커스터마이징</li>
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
