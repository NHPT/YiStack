/**
 * 类型声明文件
 * 支持 Vite/Next.js 的 ?raw 导入语法
 */

declare module '*?raw' {
  const content: string;
  export default content;
}
