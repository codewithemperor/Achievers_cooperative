import type { Metadata, Viewport } from "next";
import { Glory, Figtree } from "next/font/google";
import { MemberShell } from "@/components/member-shell";
import { Providers } from "./providers";
import "./globals.css";

const glory = Glory({
  subsets: ["latin"],
  variable: "--font-display-family",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-body-family",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Achievers Member App",
  description: "Installable member experience for wallet, loans, savings, investments, and profile management.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.jpeg",
    apple: "/logo.jpeg",
  },
};

export const viewport: Viewport = {
  themeColor: "#166534",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${glory.variable} ${figtree.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.jpeg" />
        <link rel="apple-touch-icon" href="/logo.jpeg" />
      </head>
      <body>
        <Providers>
          <MemberShell>{children}</MemberShell>
        </Providers>
      </body>
    </html>
  );
}
