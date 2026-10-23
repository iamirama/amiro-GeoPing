import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/netcheck/theme-provider";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "شبکه‌سنج | NetCheck — ابزار تست شبکه از نقاط مختلف جهان",
  description:
    "ابزار رایگان و متن‌باز برای اجرای تست‌های واقعی شبکه (Ping، TCP، UDP، DNS و HTTP/HTTPS) از سرور‌های واقعی در ایران و سایر کشورها. مبتنی بر API عمومی Globalping.",
  keywords: [
    "تست شبکه",
    "پینگ",
    "DNS",
    "HTTP",
    "TCP",
    "UDP",
    "ایران",
    "Globalping",
    "NetCheck",
    "شبکه‌سنج",
  ],
  authors: [{ name: "NetCheck" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "شبکه‌سنج | NetCheck",
    description:
      "ابزار رایگان برای اجرای تست‌های واقعی شبکه از نقاط مختلف جهان، با تمرکز ویژه بر ایران.",
    type: "website",
    locale: "fa_IR",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${vazirmatn.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
