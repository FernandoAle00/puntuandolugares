import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Rubik } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "¿Dónde comemos? | Puntuando lugares",
  description: "Guía compartida de lugares para comer, puntajes, fotos y reseñas.",
  applicationName: "Puntuando",
  appleWebApp: {
    capable: true,
    title: "Puntuando",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#F4F7F2",
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem("puntuando-theme");
    var theme = saved === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0B1511" : "#F4F7F2");
    var appleBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleBar) appleBar.setAttribute("content", theme === "dark" ? "black-translucent" : "default");
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      data-theme="light"
      suppressHydrationWarning
      className={`${rubik.variable} ${plusJakarta.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <div className="ios-status-shield" aria-hidden="true" />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
