import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Core-D - 퍼스널 컬러 & 추구미 패션 스타일링",
  description: "AI 기반 옷장 관리 및 스타일 추천 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
