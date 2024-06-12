import "../global.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import LocalFont from "next/font/local";
import { Analytics } from "@/components/analytics";
import { SpeedInsights } from "@/components/speed-insights";

export const metadata: Metadata = {
  title: {
    default: "Ronald Burns",
    template: "%s | Ronald Burns",
  },
  description:
    "Experienced developer with 10 years in Unreal Engine, 5 years in Network Operations/API Creation/DevOps, and a track record of creating integrated systems and advanced network management tools.",
  openGraph: {
    title: "Ronald Burns",
    description:
      "Experienced developer with 10 years in Unreal Engine, 5 years in Network Operations/API Creation/DevOps, and a track record of creating integrated systems and advanced network management tools.",
    url: "https://ronaldburns.dev",
    siteName: "Ronald Burns",
    images: [
      {
        url: "https://ronaldburns.dev/og.png",
        width: 1920,
        height: 1080,
      },
    ],
    locale: "en-US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  twitter: {
    title: "Ronald Burns",
    card: "summary_large_image",
  },
  icons: {
    shortcut: "/favicon.ico",
  },
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const calSans = LocalFont({
  src: "../public/fonts/CalSans-SemiBold.ttf",
  variable: "--font-calsans",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={[inter.variable, calSans.variable].join(" ")}>
      <head>
        <Analytics />
        <SpeedInsights />
      </head>
      <body
        className={`bg-black ${
          process.env.NODE_ENV === "development" ? "debug-screens" : undefined
        }`}
      >
        {children}
      </body>
    </html>
  );
}
