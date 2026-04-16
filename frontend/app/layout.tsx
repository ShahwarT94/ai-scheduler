import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Scheduler — Coach Portal",
  description: "AI-powered appointment scheduling for coaching businesses",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Mobile top bar — visible below md */}
        <header className="flex items-center border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <span className="text-base font-semibold text-gray-900">AI Scheduler</span>
        </header>

        <div className="flex h-[100dvh] overflow-hidden">
          {/* Sidebar — hidden on mobile */}
          <div className="hidden md:flex md:flex-shrink-0">
            <Sidebar />
          </div>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
