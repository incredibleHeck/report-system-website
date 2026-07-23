import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import DashboardLayout from './components/layout/DashboardLayout';
import HeadteacherDashboard from './pages/headteacher/HeadteacherDashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import SubjectGrid from './pages/teacher/SubjectGrid';
import MasterScoreSheet from './pages/teacher/MasterScoreSheet';
import ClassSettings from './pages/teacher/ClassSettings';
import ContactsPage from './pages/teacher/ContactsPage';
import HealthCheck from './pages/teacher/HealthCheck';
import ReportsPage from './pages/teacher/ReportsPage';
import DeliveryPage from './pages/teacher/DeliveryPage';
import SubjectCommentsAi from './pages/teacher/ai/SubjectCommentsAi';
import GeneralCommentsAi from './pages/teacher/ai/GeneralCommentsAi';
import CommentToolsAi from './pages/teacher/ai/CommentToolsAi';
import ChatbotWorkspace from './pages/teacher/ai/ChatbotWorkspace';
import TranscriptsPage from './pages/shared/TranscriptsPage';

function ProtectedRoute({ children, allowedRole }: { children: ReactNode; allowedRole: string }) {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser.role !== allowedRole) {
    return <Navigate to={`/${currentUser.role}`} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin-login" element={<Navigate to="/login" replace />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route element={<DashboardLayout />}>
          <Route
            path="/headteacher"
            element={
              <ProtectedRoute allowedRole="headteacher">
                <HeadteacherDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/headteacher/transcripts"
            element={
              <ProtectedRoute allowedRole="headteacher">
                <TranscriptsPage />
              </ProtectedRoute>
            }
          />

          <Route path="/teacher">
            <Route
              index
              element={
                <ProtectedRoute allowedRole="teacher">
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <ClassSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="subjects/:code"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <SubjectGrid />
                </ProtectedRoute>
              }
            />
            <Route
              path="master"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <MasterScoreSheet />
                </ProtectedRoute>
              }
            />
            <Route
              path="contacts"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <ContactsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="health"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <HealthCheck />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="delivery"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <DeliveryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="ai/subject"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <SubjectCommentsAi />
                </ProtectedRoute>
              }
            />
            <Route
              path="ai/general"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <GeneralCommentsAi />
                </ProtectedRoute>
              }
            />
            <Route
              path="ai/tools"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <CommentToolsAi />
                </ProtectedRoute>
              }
            />
            <Route
              path="ai/chat"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <ChatbotWorkspace />
                </ProtectedRoute>
              }
            />
            <Route
              path="transcripts"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <TranscriptsPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
