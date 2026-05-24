import React, { useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LeaveManagement } from './components/LeaveManagement';
import { LeaveSetup } from './components/LeaveSetup';
import { LeaveCalendar } from './components/LeaveCalendar';
import { Dashboard } from './components/Dashboard';
import { Employees } from './components/Employees';
import { Company } from './components/Company';
import { Documents } from './components/Document';
import { Users } from './components/Users';
import { Salary } from './components/Salary';
import { Payroll } from './components/Payroll';
import { System } from './components/System';
import { AdminReports } from './components/AdminReports';
import { UserReports } from './components/UserReports';
import { Modules } from './components/Modules';
import { Login } from './components/Login';
import { Settings } from './components/Settings';
import { LeaveSettings } from './components/LeaveSettings';
import { NotificationSettings } from './components/NotificationSettings';
import { AuditLogs } from './components/AuditLogs';
import { CentralApproval } from './components/CentralApproval';

import { AppUser } from '../types/permissions';
import { logout as authLogout, getCurrentUser, onUserChange } from '@/lib/auth';

function loadCurrentUser(): AppUser | null {
  try {
    const u = getCurrentUser();
    if (!u || u.name.includes('undefined')) {
      sessionStorage.removeItem('current_user');
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

function loadActiveView(): string {
  return sessionStorage.getItem('activeView') || 'Dashboard';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(loadCurrentUser);
  const [activeView, setActiveView] = useState<string>(loadActiveView);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigate = (view: string) => {
    sessionStorage.setItem('activeView', view);
    setActiveView(view);
  };

  React.useEffect(() => {
    if (currentUser && (!currentUser.name || currentUser.name.includes('undefined'))) {
      authLogout();
      setCurrentUser(null);
    }
  }, [currentUser]);

  React.useEffect(() => onUserChange(freshUser => setCurrentUser(freshUser)), []);

  const handleLogin = useCallback((user: AppUser) => {
    setCurrentUser(user);
  }, []);

  const handleLogout = useCallback(() => {
    authLogout();
    sessionStorage.removeItem('activeView');
    setCurrentUser(null);
  }, []);

  const renderView = () => {
    switch (activeView) {
      case 'Dashboard': return <Dashboard />;
      case 'Modules': return <Modules />;
      case 'Employees': return <Employees />;
      case 'Company': return <Company />;
      case 'Documents': return <Documents />;
      case 'LeaveManagement':
      case 'Leave': return <LeaveManagement />;
      case 'LeaveSetup': return <LeaveSetup />;
      case 'LeaveCalendar': return <LeaveCalendar />;
      case 'Salary': return <Salary />;
      case 'Payroll': return <Payroll />;
      case 'Users': return <Users />;
      case 'System': return <System />;
      case 'Settings': return <Settings />;
      case 'AuditLogs': return <AuditLogs />;
      case 'LeaveSettings': return <LeaveSettings />;
      case 'NotificationSettings': return <NotificationSettings />;
      case 'AdminReports': return <AdminReports />;
      case 'UserReports': return <UserReports />;
      case 'CentralApproval': return <CentralApproval />;
      default: return <Dashboard />;
    }
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg)] text-[var(--text-primary)] font-sans">
      <Header
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onLogout={handleLogout}
      />
      <div className="flex flex-1 overflow-hidden relative">
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        <Sidebar
          currentUser={currentUser}
          activeView={activeView}
          setActiveView={(view) => {
            navigate(view);
            setIsMobileMenuOpen(false);
          }}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
        <main className="flex-1 overflow-y-auto w-full relative">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
