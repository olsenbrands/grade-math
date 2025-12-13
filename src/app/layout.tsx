import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "iGradeMath - AI Homework Grading",
    template: "%s | iGradeMath",
  },
  description: "AI-powered math homework grading for teachers. Scan, grade, and provide feedback in seconds.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "iGradeMath",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "iGradeMath",
    title: "iGradeMath - AI Homework Grading",
    description: "AI-powered math homework grading for teachers",
  },
  twitter: {
    card: "summary_large_image",
    title: "iGradeMath - AI Homework Grading",
    description: "AI-powered math homework grading for teachers",
  },
};

export const viewport: Viewport = {
  themeColor: "#3d9142",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
