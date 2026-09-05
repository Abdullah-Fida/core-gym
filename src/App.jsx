import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import ErrorBoundary from './components/ErrorBoundary';
import { Spinner } from './components/ui/States';

// The layouts and the login screen are part of the first paint, so they stay
// in the main bundle. Everything else is split per route — the app previously
// shipped all 30 pages plus Chart.js in a single 725 kB chunk.
import GymLayout from './components/layout/GymLayout';
import AdminLayout from './components/layout/AdminLayout';
import LoginPage from './features/auth/LoginPage';

const ForgotPasswordPage = lazy(() => import('./features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./features/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const MembersListPage = lazy(() => import('./features/members/MembersListPage'));
const AddMemberPage = lazy(() => import('./features/members/AddMemberPage'));
const EditMemberPage = lazy(() => import('./features/members/EditMemberPage'));
const MemberDetailPage = lazy(() => import('./features/members/MemberDetailPage'));
const NewMembersReportPage = lazy(() => import('./features/members/NewMembersReportPage'));
const PaymentsListPage = lazy(() => import('./features/payments/PaymentsListPage'));
const AddPaymentPage = lazy(() => import('./features/payments/AddPaymentPage'));
const RevenuePage = lazy(() => import('./features/payments/RevenuePage'));
const ExpensesListPage = lazy(() => import('./features/expenses/ExpensesListPage'));
const AddExpensePage = lazy(() => import('./features/expenses/AddExpensePage'));
const EditExpensePage = lazy(() => import('./features/expenses/EditExpensePage'));
const ExpenseSummaryPage = lazy(() => import('./features/expenses/ExpenseSummaryPage'));
const StaffListPage = lazy(() => import('./features/staff/StaffListPage'));
const TrainersPage = lazy(() => import('./features/trainers/TrainersPage'));
const DataPage = lazy(() => import('./features/data/DataPage'));
const MessagingPage = lazy(() => import('./features/messaging/MessagingPage'));
const ClassesPage = lazy(() => import('./features/classes/ClassesPage'));
const LeadsPage = lazy(() => import('./features/leads/LeadsPage'));
const PosPage = lazy(() => import('./features/pos/PosPage'));
const AddStaffPage = lazy(() => import('./features/staff/AddStaffPage'));
const EditStaffPage = lazy(() => import('./features/staff/EditStaffPage'));
const StaffDetailPage = lazy(() => import('./features/staff/StaffDetailPage'));
const ActionCenterPage = lazy(() => import('./features/collections/ActionCenterPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const AttendancePage = lazy(() => import('./features/attendance/AttendancePage'));
const AttendanceScanner = lazy(() => import('./features/attendance/AttendanceScanner'));
const AdminDashboardPage = lazy(() => import('./features/admin/AdminDashboardPage'));
const AdminGymsPage = lazy(() => import('./features/admin/AdminGymsPage'));
const AdminGymDetailPage = lazy(() => import('./features/admin/AdminGymDetailPage'));
const AdminPaymentsPage = lazy(() => import('./features/admin/AdminPaymentsPage'));
const AdminAlertsPage = lazy(() => import('./features/admin/AdminAlertsPage'));
const AdminSubscriptionsPage = lazy(() => import('./features/admin/AdminSubscriptionsPage'));
const AdminPlansPage = lazy(() => import('./features/admin/AdminPlansPage'));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner label="Loading page" />
    </div>
  );
}

function GymRoute({ children }) {
  const { isAuthenticated, isGymOwner } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isGymOwner) return <Navigate to="/admin/dashboard" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (isAuthenticated) {
    return <Navigate to={isAdmin ? '/admin/dashboard' : '/dashboard'} replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="/" element={<GymRoute><GymLayout /></GymRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="members" element={<MembersListPage />} />
          <Route path="members/add" element={<AddMemberPage />} />
          <Route path="members/report" element={<NewMembersReportPage />} />
          <Route path="members/:id" element={<MemberDetailPage />} />
          <Route path="members/:id/edit" element={<EditMemberPage />} />
          <Route path="payments" element={<PaymentsListPage />} />
          <Route path="payments/add" element={<AddPaymentPage />} />
          <Route path="payments/pending" element={<Navigate to="/action-center" replace />} />
          <Route path="payments/revenue" element={<RevenuePage />} />
          <Route path="expenses" element={<ExpensesListPage />} />
          <Route path="expenses/add" element={<AddExpensePage />} />
          <Route path="expenses/:id/edit" element={<EditExpensePage />} />
          <Route path="expenses/summary" element={<ExpenseSummaryPage />} />
          <Route path="staff" element={<StaffListPage />} />
          <Route path="trainers" element={<TrainersPage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="whatsapp" element={<MessagingPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="shop" element={<PosPage />} />
          <Route path="staff/add" element={<AddStaffPage />} />
          <Route path="staff/:id" element={<StaffDetailPage />} />
          <Route path="staff/:id/edit" element={<EditStaffPage />} />
          <Route path="action-center" element={<ActionCenterPage />} />
          <Route path="notifications" element={<Navigate to="/action-center" replace />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="attendance/scanner" element={<AttendanceScanner />} />
        </Route>

        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="gyms" element={<AdminGymsPage />} />
          <Route path="gyms/:id" element={<AdminGymDetailPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="alerts" element={<AdminAlertsPage />} />
          <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
          <Route path="plans" element={<AdminPlansPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <NavigationProvider>
              <ConfirmProvider>
                <AppRoutes />
              </ConfirmProvider>
            </NavigationProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
