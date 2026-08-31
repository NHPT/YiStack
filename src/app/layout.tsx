import type { Metadata } from "next";
import * as ReactDOM from 'react-dom';
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "YiStack 一栈 | AI 应用生成平台",
  description: "一站式生成、运行和迭代应用。YiStack 是基于自然语言的应用生成平台，只需一句话，即可生成完整的可运行应用。",
  keywords: ["AI", "应用生成", "低代码", "Next.js", "React", "一栈"],
  authors: [{ name: "YiStack Team" }],
  openGraph: {
    title: "YiStack 一栈 | AI 应用生成平台",
    description: "一站式生成、运行和迭代应用。",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appDebugEnabled = process.env.APP_DEBUG === 'true';
  const devGlobalStylesheet =
    process.env.NODE_ENV === 'development' ? '/_next/static/css/app/layout.css' : null;
  if (devGlobalStylesheet) {
    ReactDOM.preinit(devGlobalStylesheet, { as: 'style' });
  }

  return (
    <html lang="zh-CN" data-app-debug={appDebugEnabled ? 'true' : undefined} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
