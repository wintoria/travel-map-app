import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Topbar from "@/components/layout/Topbar";
import BottomNav from "@/components/layout/BottomNav";
import AuthWrapper from "@/components/auth/AuthWrapper";

export const metadata: Metadata = {
  title: "Travel Map App",
  description: "Nasza prywatna mapa podróży",
  // Add the manifest for PWA support
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-512x512.png",
    apple: "/icon-512x512.png",
  },
};

export const viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <AuthWrapper>
          <Topbar />
          
          <div className="pt-16 pb-16 min-h-screen flex flex-col">
            {children}
          </div>

          <BottomNav />
        </AuthWrapper>
      </body>
    </html>
  );
}