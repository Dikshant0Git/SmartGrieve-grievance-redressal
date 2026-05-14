import React, { useState } from 'react';
import { Landmark, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import api from './api';

export default function OfficerLogin() {
    const [showPassword, setShowPassword] = useState(false);
    const { login, user } = useAuth();
    const navigate = useNavigate();
    
    // Redirect if already logged in based on role
    if (user) {
        if (user.role === 'citizen') return <Navigate to="/citizen" replace />;
        if (user.role === 'officer') return <Navigate to="/dashboard" replace />;
        if (user.role === 'senior_officer' || user.role === 'admin') return <Navigate to="/admin" replace />;
    }

    const [formData, setFormData] = useState({
        name: '',
        employeeId: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data } = await api.post('/auth/officer-login', formData);
            
            // Validate role BEFORE setting global state to avoid race conditions in re-renders
            if (data.user.role === 'citizen') {
                setError("You are not authorized to access this portal.");
                return;
            }

            // If valid, proceed with login
            login(data.user, data.token);

            if (data.user.role === 'senior_officer' || data.user.role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-900 font-sans text-white">
            <div className="w-full flex items-center justify-center p-8 sm:p-12 lg:p-16 relative overflow-hidden">
                {/* Background decorative elements */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-slate-800/50 blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-amber-500/10 blur-[100px] pointer-events-none"></div>

                <div className="w-full max-w-[420px] space-y-8 relative z-10 bg-slate-800/40 p-10 rounded-2xl border border-slate-700 backdrop-blur-sm shadow-2xl">
                    
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
                            <ShieldCheck className="w-8 h-8 text-amber-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2 font-serif">
                            Authorized Personnel Only
                        </h2>
                        <p className="text-sm text-slate-400">
                            Enter your official Name, Employee ID, and Password to access the civic dashboard.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-rose-500/10 text-rose-400 p-4 rounded-lg text-sm font-medium border border-rose-500/20 text-center">
                            {error}
                        </div>
                    )}

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-300 tracking-wide uppercase">
                                Full Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g. Suresh Patel"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-slate-950/50 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-slate-500"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-300 tracking-wide uppercase">
                                Employee ID
                            </label>
                            <input
                                type="text"
                                name="employeeId"
                                value={formData.employeeId}
                                onChange={handleChange}
                                placeholder="e.g. EMP12345"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-slate-950/50 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-slate-500"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-300 tracking-wide uppercase">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    required
                                    className="w-full px-4 py-3 rounded-lg bg-slate-950/50 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-slate-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-500 transition-colors"
                                >
                                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                            </div>
                        </div>

                        <button 
                            disabled={loading}
                            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-70 text-slate-900 font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-colors mt-4 shadow-lg shadow-amber-900/10"
                        >
                            {loading ? "Verifying..." : "Secure Login"}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>

                    <div className="text-center pt-4 border-t border-slate-700/50">
                        <button
                            onClick={() => navigate('/login')}
                            className="text-sm font-medium text-slate-400 hover:text-amber-500 transition-colors"
                        >
                            Return to Citizen Portal
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}