'use client';

import React from 'react';
import Link from 'next/link';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Game Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-900">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-2xl font-bold text-red-400 mb-4">
              오류가 발생했습니다
            </h2>
            <p className="text-gray-300 mb-6">
              게임을 로드하는 중 문제가 발생했습니다.
              페이지를 새로고침하거나 홈으로 돌아가세요.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                새로고침
              </button>
              <Link
                href="/"
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                홈으로
              </Link>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-gray-500 cursor-pointer text-sm">
                  오류 상세
                </summary>
                <pre className="text-xs text-gray-600 mt-2 overflow-auto max-h-32 p-2 bg-gray-800 rounded">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
