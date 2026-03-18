import { Link, useLocation } from "wouter";
import { useTheme } from "./ThemeProvider";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Languages, BookOpen, History, Camera } from "lucide-react";
import PerplexityAttribution from "./PerplexityAttribution";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "번역", icon: Languages, shortLabel: "번역" },
    { href: "/phrases", label: "저장 문구", icon: BookOpen, shortLabel: "문구" },
    { href: "/history", label: "번역 기록", icon: History, shortLabel: "기록" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* SVG Logo */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              aria-label="Studio Translator Logo"
              className="text-primary flex-shrink-0"
            >
              <rect x="3" y="3" width="22" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none"/>
              <circle cx="14" cy="11" r="3.5" stroke="currentColor" strokeWidth="1.6" fill="none"/>
              <path d="M6 25 L11 19 L17 19 L22 25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <circle cx="20.5" cy="6.5" r="1.5" fill="currentColor" opacity="0.6"/>
            </svg>
            <div>
              <span className="font-semibold text-sm leading-none text-foreground tracking-tight">스튜디오 번역기</span>
              <span className="block text-xs text-muted-foreground leading-none mt-0.5">AI 상담 번역</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon, shortLabel }) => {
              const isActive = location === href;
              return (
                <Link key={href} href={href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={`gap-1.5 ${isActive ? "text-primary" : ""}`}
                    data-testid={`nav-${shortLabel}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{shortLabel}</span>
                  </Button>
                </Link>
              );
            })}
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "라이트 모드" : "다크 모드"}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center">
        <p className="text-xs text-muted-foreground">
          <a
            href="https://www.perplexity.ai/computer"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            Created with Perplexity Computer
          </a>
        </p>
      </footer>
    </div>
  );
}
