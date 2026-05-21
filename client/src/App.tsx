import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ChatRoute from "./pages/ChatRoute";
import Dashboard from "./pages/equipment/Dashboard";
import RequestPage from "./pages/requestform/RequestPage";
import TrackingPage from "./pages/tracking/TrackingPage";
import Accountabilities from "./pages/accountabilities/Accountabilities";
import HomeStudent from "./pages/home-student";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAccountabilities from "./pages/admin/AdminAccountabilities";
import ProfileStudent from "./pages/profile-student";
import ProfileAdmin from "./pages/admin/profile-admin";
import AdminUsers from "./pages/admin/AdminUsers";
import Analytics from "./pages/admin/Analytics";
import AdminRequestHistory from "./pages/admin/AdminRequestHistory";
import DataMigration from "./pages/admin/DataMigration";
import SuperAdminActivityLog from "./pages/admin/SuperAdminActivityLog";
import PermissionsMatrix from "./pages/admin/PermissionsMatrix";
import ManageAnnouncements from "./pages/admin/ManageAnnouncements";
import { ToastProvider } from "./context/toastContext";

import ProtectedRoute from "./components/ProtectedRoute";
import DrawerLayout from "./components/DrawerLayout";
import AdminDrawerLayout from "./components/AdminDrawerLayout";
import PageWithFooter from "./components/PageWithFooter";

const App: React.FC = () => {
  return (
    <ToastProvider>
      <Routes>
        {/* Landing page - default route */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth routes - no layout */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Chat route - available to all authenticated users */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute forbidPending>
              <ChatRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:conversationId"
          element={
            <ProtectedRoute forbidPending>
              <ChatRoute />
            </ProtectedRoute>
          }
        />

        {/* Student routes with DrawerLayout */}
        <Route
          path="/student"
          element={
            <ProtectedRoute forbidAdmin>
              <DrawerLayout>
                <PageWithFooter>
                  <HomeStudent />
                </PageWithFooter>
              </DrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/requestpage"
          element={
            <ProtectedRoute forbidAdmin>
              <DrawerLayout>
                <PageWithFooter>
                  <RequestPage />
                </PageWithFooter>
              </DrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tracking"
          element={
            <ProtectedRoute forbidAdmin>
              <DrawerLayout>
                <PageWithFooter>
                  <TrackingPage />
                </PageWithFooter>
              </DrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/accountabilities"
          element={
            <ProtectedRoute forbidAdmin>
              <DrawerLayout>
                <PageWithFooter>
                  <Accountabilities />
                </PageWithFooter>
              </DrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute forbidAdmin>
              <DrawerLayout>
                <PageWithFooter>
                  <ProfileStudent />
                </PageWithFooter>
              </DrawerLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin routes with AdminDrawerLayout */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDrawerLayout>
                <PageWithFooter>
                  <Dashboard />
                </PageWithFooter>
              </AdminDrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admindashboard"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDrawerLayout>
                <PageWithFooter>
                  <AdminDashboard />
                </PageWithFooter>
              </AdminDrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/accountabilities"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDrawerLayout>
                <PageWithFooter>
                  <AdminAccountabilities />
                </PageWithFooter>
              </AdminDrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/profile"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDrawerLayout>
                <PageWithFooter>
                  <ProfileAdmin />
                </PageWithFooter>
              </AdminDrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requireAdmin requireSuperAdmin>
              <AdminDrawerLayout>
                <PageWithFooter>
                  <AdminUsers />
                </PageWithFooter>
              </AdminDrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDrawerLayout>
                <PageWithFooter>
                  <Analytics />
                </PageWithFooter>
              </AdminDrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/migration"
          element={
            <ProtectedRoute requireAdmin requireSuperAdmin>
              <AdminDrawerLayout>
                <PageWithFooter>
                  <DataMigration />
                </PageWithFooter>
              </AdminDrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/super-activity"
          element={
            <ProtectedRoute requireAdmin requireSuperAdmin>
              <AdminDrawerLayout>
                <PageWithFooter>
                  <SuperAdminActivityLog />
                </PageWithFooter>
              </AdminDrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/history"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDrawerLayout>
                <PageWithFooter>
                  <AdminRequestHistory />
                </PageWithFooter>
              </AdminDrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/permissions"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDrawerLayout>
                <PageWithFooter>
                  <PermissionsMatrix />
                </PageWithFooter>
              </AdminDrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/announcements"
          element={
            <ProtectedRoute requireAdmin requireSuperAdmin>
              <AdminDrawerLayout>
                <PageWithFooter>
                  <ManageAnnouncements />
                </PageWithFooter>
              </AdminDrawerLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/announcements/create"
          element={
            <ProtectedRoute requireAdmin requireSuperAdmin>
              <Navigate to="/admin/announcements" replace state={{ openCreate: true }} />
            </ProtectedRoute>
          }
        />

        {/* Catch-all → redirect to default */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
};

export default App;
