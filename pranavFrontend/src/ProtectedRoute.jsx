import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children, allowedRoles, fallbackPath = "/login" }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#f5f7fb]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to={fallbackPath} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect unauthorized users to their correct dashboard
        if (user.role === 'citizen') return <Navigate to="/citizen" replace />;
        if (user.role === 'officer') return <Navigate to="/dashboard" replace />;
        if (user.role === 'senior_officer' || user.role === 'admin') return <Navigate to="/admin" replace />;
        return <Navigate to="/login" replace />;
    }

    return children;
}
