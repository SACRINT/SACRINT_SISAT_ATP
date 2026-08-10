import type { Metadata, Viewport } from "next";
import "./globals.css";
import MantenimientoListener from "@/components/MantenimientoListener";
import ChatbotTramitesWidget from "@/components/ChatbotTramitesWidget";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "SISAT-ATP — Centro de Mando",
  description: "Plataforma de gestión para supervisión escolar y acompañamiento técnico pedagógico",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SISAT-ATP",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>
          <MantenimientoListener />
          {children}
          <ChatbotTramitesWidget />
        </Providers>
      </body>
    </html>
  );
}
