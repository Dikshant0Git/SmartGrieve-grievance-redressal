import React, { useState } from 'react';
import { Landmark, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import api from './api';

export default function AuthPage() {
    const location = useLocation();
    const [isLogin, setIsLogin] = useState(location.pathname !== '/register');
    const [showPassword, setShowPassword] = useState(false);
    const { login, user } = useAuth();
    const navigate = useNavigate();
    
    // Redirect based on role if already logged in
    if (user) {
        if (user.role === 'citizen') return <Navigate to="/citizen" replace />;
        if (user.role === 'officer') return <Navigate to="/dashboard" replace />;
        if (user.role === 'senior_officer') return <Navigate to="/admin" replace />;
    }
    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        mobileNo: '',
        email: '',
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
            if (isLogin) {
                const { data } = await api.post('/auth/login', {
                    email: formData.email,
                    password: formData.password
                });
                
                // Role-based login handled in login() usually, but here we redirect manually
                login(data.user, data.token);
                
                if (data.user.role === 'officer') {
                    window.location.href = '/dashboard';
                } else if (data.user.role === 'senior_officer') {
                    window.location.href = '/admin';
                } else {
                    window.location.href = '/citizen';
                }
            } else {
                const { data } = await api.post('/auth/register', {
                    ...formData
                });
                
                // Registration now returns no token, redirect to OTP
                navigate('/verify-otp', { 
                    state: { 
                        email: data.email,
                        emailRaw: formData.email // Passing raw email for backend verification
                    } 
                });
            }
        } catch (err) {
            if (err.response?.data?.requiresVerification) {
                // Redirect unverified login attempts to OTP screen
                navigate('/verify-otp', { 
                    state: { 
                        email: err.response.data.email,
                        emailRaw: formData.email
                    } 
                });
                return;
            }
            setError(err.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-white font-sans text-slate-900 relative">
            {/* Subtle Officer Login Link */}
            <a 
                href="/officer-login" 
                className="absolute top-4 right-6 text-[13px] font-bold text-slate-400 hover:text-amber-600 uppercase tracking-widest transition-colors z-50"
            >
                Officer / Admin Login
            </a>

            {/* LEFT PANEL - Branding (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-[#0A111F] overflow-hidden flex-col justify-end p-16">
                <div
                    className="absolute inset-0 bg-[url('.././public/RajaBhoj.jpg')] bg-cover bg-[position:50%_40%] opacity-90 mix-blend-luminosity"
                ></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A111F] via-[#0A111F]/80 to-[#0A111F]/20"></div>

                <div className="relative z-10 text-white max-w-lg">
                    <div className="flex items-center gap-3 mb-10">
                        <Landmark className="w-8 h-8 text-amber-500" />
                        <span className="text-2xl font-bold tracking-tight">SmartGrieve</span>
                    </div>
                    <h1 className="text-[40px] leading-tight font-bold mb-6">
                        {isLogin ? "Welcome to the administrative console." : "Join the civic administrative network."}
                    </h1>
                    <p className="text-slate-400 text-lg leading-relaxed">
                        Access your dashboard to manage municipal grievances, track resolution metrics, and maintain the efficiency of <span className='text-amber-500 font-bold'>Bhopal's</span> civic services.
                    </p>
                </div>
            </div>

            {/* RIGHT PANEL - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-16 overflow-y-auto">
                <div className="w-full max-w-[420px] space-y-8">

                    <div>
                        <h2 className="text-3xl font-bold text-slate-900">
                            {isLogin ? "Sign In" : "Create Account"}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                            {isLogin
                                ? "Enter your official credentials to access the system."
                                : "Register with your official details to gain access."}
                        </p>
                    </div>

                    {error && (
                        <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm font-medium border border-rose-100">
                            {error}
                        </div>
                    )}

                    <form className="space-y-5" onSubmit={handleSubmit}>

                        {!isLogin && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 tracking-wide">Full Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="e.g. Suresh Patel"
                                        required
                                        className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-400"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 tracking-wide">Mobile Number</label>
                                    <input
                                        type="tel"
                                        name="mobileNo"
                                        value={formData.mobileNo}
                                        onChange={handleChange}
                                        placeholder="+91 98765 43210"
                                        required
                                        className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-400"
                                    />
                                </div>
                            </>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 tracking-wide">
                                Official Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="e.g. admin@bhopal.gov.in"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-400"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-700 tracking-wide">
                                    {isLogin ? "Password" : "Create Password"}
                                </label>
                                {isLogin && (
                                    <Link to="/forgot-password" size="sm" className="text-xs font-bold text-slate-700 hover:text-amber-600 transition-colors">
                                        Forgot Password?
                                    </Link>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    required
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                            </div>
                        </div>

                        <button 
                            disabled={loading}
                            className="w-full bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-70 text-white font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 transition-colors mt-2 shadow-sm"
                        >
                            {loading ? "Processing..." : isLogin ? "Access Console" : "Register Account"}
                            {!loading && <ArrowRight size={18} />}
                        </button>

                    </form>

                    <div className="text-center space-y-4 pt-4">
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            By signing in, you agree to the <a href="#" className="font-semibold hover:text-slate-800">Terms of Service</a> and <a href="#" className="font-semibold hover:text-slate-800">Privacy Policy</a>.
                        </p>
                        <p className="text-sm font-medium text-slate-600">
                            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                            <Link
                                to={isLogin ? "/register" : "/login"}
                                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                                className="text-amber-600 font-bold hover:underline"
                            >
                                {isLogin ? "Register" : "Sign In"}
                            </Link>
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}