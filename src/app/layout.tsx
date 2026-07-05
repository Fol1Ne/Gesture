import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gesture — Live ASL Translator",
  description:
    "Real-time American Sign Language recognition for meetings: webcam-based ASL-to-text translation, live captions overlay, and speech output.",
};

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full dark antialiased ${jetbrainsMono.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
