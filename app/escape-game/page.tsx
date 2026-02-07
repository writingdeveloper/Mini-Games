'use client';

import Link from "next/link";
import { useState } from "react";

const GAME_SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || '';

export default function EscapeGame() {
  const [mode, setMode] = useState<'select' | 'single' | 'multi'>('select');

  const iframeSrc = mode === 'multi' && GAME_SERVER_URL
    ? `/escape-game/index.html?mode=multi&server=${encodeURIComponent(GAME_SERVER_URL)}`
    : '/escape-game/index.html';

  if (mode === 'select') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900">
        <Link
          href="/"
          className="absolute top-4 left-4 z-10 bg-black/70 hover:bg-black/90 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          홈으로
        </Link>
        <div className="flex flex-col items-center gap-8">
          <h1 className="text-5xl font-bold text-white">도주 게임</h1>
          <p className="text-xl text-orange-200">플레이 모드를 선택하세요</p>
          <div className="flex gap-6">
            <button
              onClick={() => setMode('single')}
              className="px-8 py-4 bg-gradient-to-br from-orange-500 to-red-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:scale-105 transition-transform"
            >
              싱글플레이어
            </button>
            <button
              onClick={() => setMode('multi')}
              disabled={!GAME_SERVER_URL}
              className="px-8 py-4 bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              멀티플레이어
            </button>
          </div>
          {!GAME_SERVER_URL && (
            <p className="text-sm text-red-300">멀티플레이어 서버가 설정되지 않았습니다</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Link
          href="/"
          className="bg-black/70 hover:bg-black/90 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          홈으로
        </Link>
        <button
          onClick={() => setMode('select')}
          className="bg-black/70 hover:bg-black/90 text-white px-4 py-2 rounded-lg transition-colors"
        >
          모드 선택
        </button>
      </div>
      <iframe
        src={iframeSrc}
        className="h-full w-full border-0"
        title="도주 게임"
      />
    </div>
  );
}
