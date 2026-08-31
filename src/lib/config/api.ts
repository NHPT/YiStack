// API 配置
// 修改后端地址时，只需修改此文件

export const API_CONFIG = {
  // 后端 API 地址
  // 开发环境: http://localhost:8080
  // 生产环境: https://your-backend-domain.com
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8080',
} as const;

export type APIConfig = typeof API_CONFIG;
