import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
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
  // Favicon/apple-touch-icon are auto-generated from app/icon.png and app/apple-icon.png
};

export const viewport = {
  themeColor: "#111815",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" data-theme="forest">
      <body className="bg-base-100 text-base-content antialiased">
        <Toaster
          position="bottom-center"
          containerStyle={{ zIndex: 99999 }}
          toastOptions={{
            duration: 4000,
            style: {
              fontSize: "0.875rem",
              maxWidth: "24rem",
              background: "#17201C",
              color: "#F0EDE3",
              border: "1px solid #26352D",
            },
            success: { iconTheme: { primary: "#6F8F63", secondary: "#F0EDE3" } },
            error: { iconTheme: { primary: "#9A514F", secondary: "#F0EDE3" } },
          }}
        />
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