import type { Metadata, Viewport } from "next";
import { MemberShell } from "./components/member-shell";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Achievers Member App",
  description: "Installable member experience for wallet, loans, savings, investments, and profile management.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#2d5a27",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <MemberShell>{children}</MemberShell>
        </Providers>
      </body>
    </html>
  );
}
