# 🎮 Mini Games Hub

여러 게임을 한곳에서 즐길 수 있는 게임 허브입니다. Next.js와 Tailwind CSS로 제작되었습니다.

## 게임 목록

### 🚗 도주 게임
- 2D 캔버스 기반 게임
- 자동차를 조종해서 경찰차로부터 도주
- 방향키로 조종
- 점수 시스템

### 🌍 3D 서바이벌 게임
- Babylon.js 기반 3D 오픈 월드
- 서바이벌 시스템 (체력, 스태미나, 배고픔, 갈증)
- 캐릭터 커스터마이징
- WASD 이동 및 마우스 시점 조작

## 시작하기

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

### 빌드

```bash
npm run build
```

### 프로덕션 실행

```bash
npm start
```

## 프로젝트 구조

```
Mini-Games/
├── app/
│   ├── page.tsx              # 메인 허브 페이지
│   ├── escape-game/
│   │   └── page.tsx          # 도주 게임 라우트
│   └── survival-game/
│       └── page.tsx          # 서바이벌 게임 라우트
├── public/
│   ├── escape-game/          # 도주 게임 파일들
│   │   ├── index.html
│   │   ├── game.js
│   │   └── style.css
│   └── survival-game/        # 서바이벌 게임 파일들
│       ├── index.html
│       └── src/
│           └── main.ts
└── package.json
```

## Vercel 배포

1. GitHub에 푸시:
```bash
git add .
git commit -m "Setup Mini Games Hub with Next.js"
git push origin main
```

2. [Vercel](https://vercel.com)에 로그인

3. "New Project" 클릭

4. GitHub 레포지토리 선택

5. 자동으로 Next.js 프로젝트를 감지하고 배포 시작

## 기술 스택

- **Frontend Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Game Engines**:
  - 도주 게임: HTML Canvas
  - 서바이벌 게임: Babylon.js

## 라이선스

MIT License

## 새 게임 추가하기

1. \`public/\` 디렉토리에 새 게임 폴더 생성
2. \`app/\` 디렉토리에 새 라우트 생성
3. 메인 페이지(\`app/page.tsx\`)에 게임 카드 추가

예시:
\`\`\`tsx
// app/new-game/page.tsx
export default function NewGame() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <iframe
        src="/new-game/index.html"
        className="h-full w-full border-0"
        title="새 게임"
      />
    </div>
  );
}
\`\`\`
