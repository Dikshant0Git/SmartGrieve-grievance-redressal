import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import AuthPage from './LoginRegister';
import ProtectedRoute from './ProtectedRoute';

import OfficerLogin from './OfficerLogin';
import AdminDashboard from './AdminDashboard';
import CitizenDashboard from './CitizenDashboard';
import OfficerDashboard from './OfficerDashboard';
import VerifyOtp from './VerifyOtp';
import ForgotPassword from './ForgotPassword';

const AppRoutes = () => {
    const { user, loading } = useAuth();

    if (loading) return null; // Or a full screen loader

    // Fallback logic for catch-all
    const getFallbackRoute = () => {
        if (!user) return "/login";
        if (user.role === 'citizen') return "/citizen";
        if (user.role === 'senior_officer' || user.role === 'admin') return "/admin";
        return "/dashboard"; // default for officers/admins
    };

    return (
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
    );
};

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
