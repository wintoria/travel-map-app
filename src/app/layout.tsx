import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Topbar from "@/components/Topbar";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Travel Map App",
  description: "Nasza prywatna mapa podróży",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <Topbar />
        
        <div className="pt-16 pb-16 min-h-screen flex flex-col">
          {children}
        </div>

        <BottomNav />
      </body>
    </html>
  );
}