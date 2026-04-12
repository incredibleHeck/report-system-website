/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import DashboardLayout from './components/layout/DashboardLayout';
import HeadteacherDashboard from './pages/headteacher/HeadteacherDashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import SubjectGrid from './pages/teacher/SubjectGrid';
import MasterScoreSheet from './pages/teacher/MasterScoreSheet';
import StudentDashboard from './pages/student/StudentDashboard';

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode, allowedRole: string }) {
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
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        <Route element={<DashboardLayout />}>
          <Route path="/headteacher" element={
            <ProtectedRoute allowedRole="headteacher">
              <HeadteacherDashboard />
            </ProtectedRoute>
          } />
          <Route path="/teacher">
            <Route index element={
              <ProtectedRoute allowedRole="teacher">
                <TeacherDashboard />
              </ProtectedRoute>
            } />
            <Route path="grid" element={
              <ProtectedRoute allowedRole="teacher">
                <SubjectGrid />
              </ProtectedRoute>
            } />
            <Route path="master" element={
              <ProtectedRoute allowedRole="teacher">
                <MasterScoreSheet />
              </ProtectedRoute>
            } />
            <Route path="analytics" element={
              <ProtectedRoute allowedRole="teacher">
                <AiAnalytics />
              </ProtectedRoute>
            } />
          </Route>
          <Route path="/student" element={
            <ProtectedRoute allowedRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
