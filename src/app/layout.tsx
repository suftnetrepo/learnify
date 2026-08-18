import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width:      "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "Learnify — Premium Learning Platform",
    template: "%s | Learnify",
  },
  description: "Discover expert-led courses, learn at your own pace, and advance your career with Learnify.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  keywords: ["online learning", "courses", "e-learning", "education", "skills", "career development"],
  authors: [{ name: "Learnify" }],
  openGraph: {
    type:        "website",
    locale:      "en_GB",
    siteName:    "Learnify",
    title:       "Learnify — Premium Learning Platform",
    description: "Discover expert-led courses, learn at your own pace, and advance your career.",
    images: [
      {
        url:    "/og-image.png",
        width:  1200,
        height: 630,
        alt:    "Learnify — Premium Learning Platform",
      },
    ],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "Learnify — Premium Learning Platform",
    description: "Discover expert-led courses and advance your career.",
    images:      ["/og-image.png"],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
