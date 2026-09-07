import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/client";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "German Study OS",
  description: "A private, data-driven German study tracker.",
};

async function resolveTheme(): Promise<"light" | "dark" | undefined> {
  const session = await auth();
  if (!session?.user?.id) return undefined;
  const settings = await prisma.settings.findUnique({ where: { userId: session.user.id } });
  if (settings?.theme === "light" || settings?.theme === "dark") return settings.theme;
  return undefined; // "system" (or no settings yet) — no attribute, prefers-color-scheme decides
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await resolveTheme();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
