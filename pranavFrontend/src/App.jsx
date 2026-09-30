import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import AuthPage from './LoginRegister';
import ProtectedRoute from './ProtectedRoute';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const OfficerLogin = lazy(() => import('./OfficerLogin'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const CitizenDashboard = lazy(() => import('./CitizenDashboard'));
const OfficerDashboard = lazy(() => import('./OfficerDashboard'));
const VerifyOtp = lazy(() => import('./VerifyOtp'));
const ForgotPassword = lazy(() => import('./ForgotPassword'));

const PageLoader = () => (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
    </div>
);

const AppRoutes = () => {
    const { user, loading } = useAuth();

    if (loading) return <PageLoader />;

    // Fallback logic for catch-all
    const getFallbackRoute = () => {
        if (!user) return "/login";
        if (user.role === 'citizen') return "/citizen";
        if (user.role === 'senior_officer' || user.role === 'admin') return "/admin";
        return "/dashboard"; // default for officers/admins
    };

    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* Redirect root based on role */}
                <Route path="/" element={<Navigate to={getFallbackRoute()} replace />} />

                {/* Public/Auth Routes */}
                <Route path="/login" element={<AuthPage />} />
                <Route path="/register" element={<AuthPage />} />
                <Route path="/verify-otp" element={<VerifyOtp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/officer-login" element={<OfficerLogin />} />

                {/* Protected Routes */}
                <Route 
                    path="/citizen" 
                    element={
                        <ProtectedRoute allowedRoles={['citizen']} fallbackPath="/login">
                            <CitizenDashboard />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/dashboard" 
                    element={
                        <ProtectedRoute allowedRoles={['officer']} fallbackPath="/officer-login">
                            <OfficerDashboard />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/admin" 
                    element={
                        <ProtectedRoute allowedRoles={['senior_officer', 'admin']} fallbackPath="/officer-login">
                            <AdminDashboard />
                        </ProtectedRoute>
                    } 
                />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to={getFallbackRoute()} replace />} />
            </Routes>
        </Suspense>
    );
};

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
                <ToastContainer 
                    position="top-right"
                    autoClose={4000}
                    hideProgressBar={false}
                    newestOnTop
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="colored"
                />
            </AuthProvider>
        </BrowserRouter>
    );
}
