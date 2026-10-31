import { Roboto, Lato } from "next/font/google";
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
  display: "swap",
});
import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: {
    default: "HireSync | Recruit. Schedule. Hire.",
    template: "%s | HireSync",
  },
  description:
    "HireSync is an AI-assisted recruitment platform for resume analysis, candidate scoring, interview scheduling, and hiring workflows.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
  <html lang="en" className={`${roboto.variable} ${lato.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
