import React, { useState, useEffect } from 'react';
import { Zap, Menu, LayoutGrid, UserCircle, CalendarDays, Bell, Search, Settings, LogOut, Moon, Sun } from 'lucide-react';
import { AppUser } from '@/types/permissions';
import { setTheme } from '@/lib/theme';

export function Header({ onMenuToggle, onLogout, currentUser }: { onMenuToggle: () => void; onLogout?: () => void; currentUser?: AppUser | null }) {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  // Keep the toggle in sync if the applied theme changes elsewhere (e.g. login).
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, [currentUser]);

  const toggleDarkMode = () => {
    const next = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    setTheme(next);   // applies the class, updates the cached user, and persists to the server
  };
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="h-[60px] bg-[var(--surface)] text-[var(--text-primary)] flex items-center justify-between px-4 sm:px-5 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)] relative z-50 border-b border-[var(--border)]">
      {/* Left section */}
      <div className="flex items-center gap-3 sm:gap-6 h-full">
        <button 
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        {/* Logo / Brand */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[var(--accent)] flex items-center justify-center shadow-inner">
            <span className="text-white font-bold text-[15px] tracking-tight syne">HR</span>
          </div>
          <span className="text-[17px] font-bold text-[var(--text-primary)] tracking-wide hidden sm:block syne">
            USG <span className="font-normal text-[var(--text-muted)]">Portal</span>
          </span>
        </div>
      </div>

      {/* Center - Date */}
      <div className="hidden md:flex items-center absolute left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--surface-hover)] rounded-full border border-[var(--border)] group cursor-default transition-colors">
          <CalendarDays className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-[12px] font-medium text-[var(--text-secondary)] tracking-wide">{currentDate}</span>
        </div>
      </div>
{/* Right section */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Search */}
        <div className="hidden lg:flex items-center bg-[var(--surface-hover)] transition-colors rounded-full px-3 py-1.5 border border-[var(--border)] mr-2 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent-dim)]">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] mr-2" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-transparent border-none outline-none text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] w-[140px] xl:w-[200px]"
            />
        </div>

        {/* Quick Actions */}
        <button onClick={toggleDarkMode} className="hidden sm:flex items-center justify-center p-2 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] rounded-full transition-colors" title="Toggle Theme">
          {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        <button className="hidden sm:flex items-center justify-center p-2 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] rounded-full transition-colors" title="Settings">
          <Settings className="w-[18px] h-[18px]" />
        </button>
        
        <button className="relative flex items-center justify-center p-2 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] rounded-full transition-colors" title="Notifications">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-[var(--danger)] rounded-full border border-white"></span>
        </button>

        <button className="relative flex items-center justify-center p-2 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] rounded-full transition-colors" title="Apps">
          <LayoutGrid className="w-[18px] h-[18px]" />
        </button>

        <div className="w-[1px] h-6 bg-[var(--border)] mx-1"></div>

        {/* User Profile */}
        <div className="flex items-center gap-2 hover:bg-[var(--surface-hover)] p-1.5 pl-2 rounded-full transition-colors flex-shrink-0 cursor-default border border-transparent hover:border-[var(--border)]">
          <div className="hidden sm:flex flex-col items-end">
             <span className="text-[12px] font-semibold text-[var(--text-primary)] leading-tight">{currentUser?.name || currentUser?.email || 'User'}</span>
          </div>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--accent-dim)] flex items-center justify-center overflow-hidden shrink-0">
            <UserCircle className="w-full h-full text-[var(--accent)] p-0.5" />
          </div>
        </div>

        {/* Logout */}
        {onLogout && (
          <button 
            onClick={onLogout}
            className="flex items-center justify-center p-2 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-dim)] rounded-full transition-colors ml-1" 
            title="Log Out"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        )}
      </div>
    </header>
  );
}
