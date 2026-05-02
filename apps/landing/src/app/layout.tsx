import type { Metadata, Viewport } from "next";
import { Glory, Figtree } from "next/font/google";
// import "@heroui/react/dist/styles.css";
import "./globals.css";
import { siteConfig } from "@/data/content";
import { Providers } from "@/components/ui/Providers";
import AppChrome from "@/components/layout/AppChrome";

const displayFont = Glory({
  subsets: ["latin"],
  variable: "--font-display-family",
});

const bodyFont = Figtree({
  subsets: ["latin"],
  variable: "--font-body-family",
});

export const viewport: Viewport = {
  themeColor: "#166534",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} - ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: "website",
  },
  icons: {
    icon: "/logo.jpeg",
    apple: "/logo.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.jpeg" />
        <link rel="apple-touch-icon" href="/logo.jpeg" />
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
