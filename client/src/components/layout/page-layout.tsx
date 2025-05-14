import { ReactNode } from "react";
import { NavigationBar } from "./navigation-bar";

interface PageLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function PageLayout({ children, showNav = true }: PageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {showNav && <NavigationBar />}
      <main className="flex-1 px-6">{children}</main>
    </div>
  );
}