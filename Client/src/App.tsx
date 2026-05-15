import React,{useState,useEffect,useCallback} from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
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

import { AppUser } from '../types/permissions';
import { logout as authLogout, getCurrentUser, onUserChange } from '@/lib/auth';

import ProtectedRoute from './components/ProtectedRoute';


// ─────────────────────────────────────────────────────────────
// Helper to load user from storage and normalize
// ─────────────────────────────────────────────────────────────
function loadCurrentUser(): AppUser | null {
  try {
    const u = getCurrentUser();
    // Detect sessions created before the normalizer field-name fix
    // (name was "undefined undefined" because the backend sends firstName/lastName
    //  but the old code read firstname/lastname). Clear and force re-login.
    if (!u || u.name.includes('undefined')) {
      sessionStorage.removeItem('current_user');
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Protected Layout Wrapper
// ─────────────────────────────────────────────────────────────
function Layout({ user, onLogout }: { user: AppUser; onLogout: () => void }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  function handleOpenProfile(tab?: string) {
    navigate(tab ? `/profile?tab=${tab}` : '/profile');
  }

  return (
    <div className="flex min-h-screen bg-[#f7f7fa] dark:bg-gray-950">
      <Sidebar
        currentUser={user}
        activeView=""
        setActiveView={() => {}}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <Header
          user={user}
          onLogout={onLogout}
          onToggleSidebar={() => setIsSidebarOpen((prev: boolean) => !prev)}
          onOpenProfile={handleOpenProfile}
        />

        <main className="flex-1 overflow-auto">
          <Routes>
            {/* Dashboard — open to all authenticated users */}
            <Route path="/dashboard" element={<Dashboard user={user} />} />

            {/* Profile */}
            <Route path="/profile" element={<ProfilePage user={user} />} />

            {/* Applicant */}
            <Route path="/admission/applicants" element={
              <ProtectedRoute user={user} navKey="admission-applicants">
                <ApplicantManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Employee */}
            <Route path="/employees" element={
              <ProtectedRoute user={user} navKey="create-employee">
                <EmployeeManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Interview */}
            <Route path="/admission/interviews" element={
              <ProtectedRoute user={user} navKey="admission-interviews">
                <InterviewManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Admissions */}
            <Route path="/admission/admissions" element={
              <ProtectedRoute user={user} navKey="admission-admissions">
                <Admissions user={user} />
              </ProtectedRoute>
            } />

            {/* Students */}
            <Route path="/students" element={
              <ProtectedRoute user={user} navKey="students">
                <StudentManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Teachers */}
            <Route path="/teachers" element={
              <ProtectedRoute user={user} navKey="teachers">
                <TeacherManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Subject */}
            <Route path="/subject" element={
              <ProtectedRoute user={user} navKey="subject">
                <SubjectManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Class */}
            <Route path="/class" element={
              <ProtectedRoute user={user} navKey="class">
                <ClassManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Schedule */}
            <Route path="/schedule" element={
              <ProtectedRoute user={user} navKey="schedule">
                <ScheduleManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Library */}
            <Route path="/library" element={
              <ProtectedRoute user={user} navKey="library">
                <LibraryManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Attendance */}
            <Route path="/attendance" element={
              <ProtectedRoute user={user} navKey="attendance">
                <AttendanceManagement user={user} />
              </ProtectedRoute>
            } />
            <Route path="/attendance/teacher" element={
              <ProtectedRoute user={user} navKey="attendance-teacher">
                <TeacherAttendanceManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Notice */}
            <Route path="/notice" element={
              <ProtectedRoute user={user} navKey="notice">
                <NoticeManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Transport */}
            <Route path="/transport" element={
              <ProtectedRoute user={user} navKey="transport">
                <TransportManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Payroll */}
            <Route path="/payroll" element={
              <ProtectedRoute user={user} navKey="create-payroll">
                <PayrollManagement user={user} />
              </ProtectedRoute>
            } />

            {/* Fees */}
            <Route path="/fees/structure" element={
              <ProtectedRoute user={user} navKey="fees-structure">
                <FeeStructure user={user} />
              </ProtectedRoute>
            } />
            <Route path="/fees/payment" element={
              <ProtectedRoute user={user} navKey="fees-payment">
                <FeePayment user={user} />
              </ProtectedRoute>
            } />

            {/* Exams */}
            <Route path="/exams/record" element={
              <ProtectedRoute user={user} navKey="exam-record">
                <ExamRecord user={user} />
              </ProtectedRoute>
            } />
            <Route path="/exams/approve" element={
              <ProtectedRoute user={user} navKey="exam-approve">
                <ExamApprove user={user} />
              </ProtectedRoute>
            } />
            <Route path="/exams/broadsheet" element={
              <ProtectedRoute user={user} navKey="exam-broadsheet">
                <ExamBroadsheet user={user} />
              </ProtectedRoute>
            } />
            <Route path="/exams/report-card" element={
              <ProtectedRoute user={user} navKey="exam-report-card">
                <ReportCard user={user} />
              </ProtectedRoute>
            } />

            {/* Settings */}
            <Route path="/settings/users" element={
              <ProtectedRoute user={user} navKey="settings-users">
                <UserCreation user={user} />
              </ProtectedRoute>
            } />
            <Route path="/settings/system" element={
              <ProtectedRoute user={user} navKey="settings-system">
                <SystemConfiguration />
              </ProtectedRoute>
            } />
            <Route path="/settings/super-admin" element={
              <ProtectedRoute user={user} navKey="settings-super-admin">
                <SuperAdminSettings />
              </ProtectedRoute>
            } />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}


export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(loadCurrentUser);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeView, setActiveView] = useState('Dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Clear sessions that have a broken name ("undefined undefined") caused by the
  // old normalizeFromLogin reading the wrong field names from the login response.
  // This runs on mount AND after HMR hot-reloads (where useState initializer skips).
  useEffect(() => {
    if (currentUser && (!currentUser.name || currentUser.name.includes('undefined'))) {
      authLogout();
      setCurrentUser(null);
    }
  }, [currentUser]);

  // In handleLogin — it already receives AppUser, no need to normalize again:
  // Keep React state in sync when a silent token refresh delivers fresh permissions
  React.useEffect(() => onUserChange(freshUser => setCurrentUser(freshUser)), []);

  const handleLogin = useCallback((user: AppUser) => {
    setCurrentUser(user);
  }, []);

  const handleLogout = useCallback(() => {
    authLogout();
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
      default: return <Dashboard />;
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg)] text-[var(--text-primary)] font-sans">
      <Header 
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
        onLogout={() => setIsLoggedIn(false)}
      />
      <div className="flex flex-1 overflow-hidden relative">
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        <Sidebar 
          activeView={activeView} 
          setActiveView={(view) => {
            setActiveView(view);
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

