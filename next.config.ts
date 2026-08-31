import type { NextConfig } from 'next';

const BACKEND_PORT = process.env.APP_PORT || process.env.BACKEND_PORT || '8080';
const DIST_DIR = process.env.NEXT_DIST_DIR || '.next';

function normalizeDevOrigin(origin: string) {
  const value = origin.trim();
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch {
    return value.includes(':') && value.indexOf(':') !== value.lastIndexOf(':')
      ? value
      : value.replace(/:\d+$/, '');
  }
}

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map(normalizeDevOrigin)
  .filter(Boolean);

const nextConfig: NextConfig = {
  distDir: DIST_DIR,
  // API 代理配置 - 将 /api/* 请求代理到 Go 后端
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${BACKEND_PORT}/api/:path*`,
      },
    ];
  },
  // 默认使用同源地址访问开发服务。
  // 若需要通过额外域名/IP 访问 dev server，可在环境变量中配置 NEXT_ALLOWED_DEV_ORIGINS。
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/.dbg/**',
          '**/debug-*.md',
          '**/logs/**',
          '**/runtime/**',
          '**/backend/yistack-server',
          '**/.next-dev/**',
          '**/.next-dev-test/**',
          '**/.next-agent/**',
          '**/.next-dev-poll/**',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
