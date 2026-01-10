import type { Metadata } from "next";

import "./globals.css";
//import "@copilotkit/react-ui/styles.css";
import "@copilotkit/react-core/v2/styles.css";

export const metadata: Metadata = {
  title: "AG-UI - State patch demo",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased flex flex-col h-screen">
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
