import type { Metadata } from "next";
import { JetBrains_Mono, Rubik } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import Providers from "./providers";

const rubik = Rubik({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vibe",
  description: "Vibecode and deploy to appwrite sites",
  icons: "/logo.png",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        // Yea NO LIGHT MODE
        className={`${rubik.className} ${rubik.variable} ${jetBrainsMono.variable} dark antialiased`}
      >
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
