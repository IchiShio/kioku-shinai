import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "記憶しない英単語 | 語源×認知言語学で「理解する」単語学習",
  description:
    "丸暗記は忘れる。語源分解×認知言語学で英単語を「理解」すれば、もう忘れない。無料体験で3分で実感。",
  openGraph: {
    title: "記憶しない英単語",
    description:
      "丸暗記は忘れる。語源×認知言語学で「理解する」単語学習。無料体験で3分で実感。",
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: "記憶しない英単語",
    description:
      "丸暗記は忘れる。語源×認知言語学で「理解する」単語学習。",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
