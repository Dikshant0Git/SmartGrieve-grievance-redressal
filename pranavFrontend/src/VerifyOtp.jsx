import React, { useState, useEffect, useRef } from 'react';
import { Landmark, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import api from './api';
import { toast } from 'react-toastify';

export default function VerifyOtp() {
    const { login, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Redirect if already logged in and verified
    if (user && user.isEmailVerified) {
        return <Navigate to="/citizen" replace />;
    }

    const email = location.state?.email;
    
    // Redirect if no email in state (accessed directly)
    if (!email) {
        return <Navigate to="/register" replace />;
    }

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [timer, setTimer] = useState(60);
    const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleChange = (index, value) => {
        // Only allow numbers
        if (value && !/^\d+$/.test(value)) return;

        const newOtp = [...otp];
        // Take only last character if multiple characters are entered
        newOtp[index] = value.substring(value.length - 1);
        setOtp(newOtp);

        // Move to next input
        if (value && index < 5) {
            inputRefs[index + 1].current.focus();
        }

        // Auto submit if all filled
        if (newOtp.every(digit => digit !== '') && value) {
            handleVerify(newOtp.join(''));
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs[index - 1].current.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const data = e.clipboardData.getData('text').trim();
        if (!/^\d+$/.test(data)) return;

        const digits = data.split('').slice(0, 6);
        const newOtp = [...otp];
        
        digits.forEach((digit, i) => {
            if (i < 6) newOtp[i] = digit;
        });
        
        setOtp(newOtp);
        
        // Focus last digit or next empty
        const lastIndex = Math.min(digits.length, 5);
        inputRefs[lastIndex].current.focus();

        if (newOtp.every(digit => digit !== '')) {
            handleVerify(newOtp.join(''));
        }
    };

    const handleVerify = async (otpCode) => {
        setLoading(true);
        try {
            const { data } = await api.post('/auth/verify-otp', {
                email: location.state.emailRaw || email, // Use raw email if available, else masked (backend needs raw)
                otp: otpCode
            });
            
            toast.success(data.message);
            login(data.user, data.token);
            window.location.href = '/citizen';
        } catch (err) {
            toast.error(err.response?.data?.message || 'Verification failed');
            // Shake effect or clear? 
            setOtp(['', '', '', '', '', '']);
            inputRefs[0].current.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (timer > 0 || resendLoading) return;
        
        setResendLoading(true);
        try {
            const { data } = await api.post('/auth/resend-otp', {
                email: location.state.emailRaw || email
            });
            toast.success(data.message);
            setTimer(60);
            setOtp(['', '', '', '', '', '']);
            inputRefs[0].current.focus();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to resend OTP');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-white font-sans text-slate-900 relative">
            {/* LEFT PANEL - Branding (Consistent with AuthPage) */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-[#0A111F] overflow-hidden flex-col justify-end p-16">
                <div className="absolute inset-0 bg-[url('.././public/RajaBhoj.jpg')] bg-cover bg-[position:50%_40%] opacity-90 mix-blend-luminosity"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A111F] via-[#0A111F]/80 to-[#0A111F]/20"></div>

                <div className="relative z-10 text-white max-w-lg">
                    <div className="flex items-center gap-3 mb-10">
                        <Landmark className="w-8 h-8 text-amber-500" />
                        <span className="text-2xl font-bold tracking-tight">SmartGrieve</span>
                    </div>
                    <h1 className="text-[40px] leading-tight font-bold mb-6">
                        Verify your identity to proceed.
                    </h1>
                    <p className="text-slate-400 text-lg leading-relaxed">
                        We've sent a 6-digit verification code to <span className="text-white font-bold">{email}</span>. This helps us ensure the security of Bhopal's civic network.
                    </p>
                </div>
            </div>

            {/* RIGHT PANEL - OTP Input */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-16">
                <div className="w-full max-w-[420px] space-y-10">
                    
                    <div className="text-center lg:text-left">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mb-6 lg:mb-8">
                            <CheckCircle2 className="w-8 h-8 text-amber-600" />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900">Email Verification</h2>
                        <p className="mt-3 text-slate-500 leading-relaxed">
                            Enter the code sent to your inbox. If you don't see it, check your <span className="font-semibold italic">spam folder</span>.
                        </p>
                    </div>

                    <div className="space-y-8">
                        <div className="flex justify-between gap-2 sm:gap-4" onPaste={handlePaste}>
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={inputRefs[index]}
                                    type="text"
                                    inputMode="numeric"
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold border-2 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all border-slate-200"
                                />
                            ))}
                        </div>

                        <button
                            onClick={() => handleVerify(otp.join(''))}
                            disabled={loading || otp.some(d => d === '')}
                            className="w-full bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-70 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-md shadow-amber-500/20 active:scale-[0.98]"
                        >
                            {loading ? "Verifying..." : "Confirm Verification"}
                            {!loading && <ArrowRight size={20} />}
                        </button>

                        <div className="text-center">
                            <p className="text-sm text-slate-500">
                                Didn't receive the code?{' '}
                                <button
                                    onClick={handleResend}
                                    disabled={timer > 0 || resendLoading}
                                    className={`font-bold transition-colors ${timer > 0 || resendLoading ? 'text-slate-300 cursor-not-allowed' : 'text-amber-600 hover:text-amber-700 underline underline-offset-4'}`}
                                >
                                    {resendLoading ? (
                                        <span className="flex items-center gap-2">
                                            <RefreshCw className="w-4 h-4 animate-spin" /> Sending...
                                        </span>
                                    ) : timer > 0 ? (
                                        `Resend in ${timer}s`
                                    ) : (
                                        "Resend Code"
                                    )}
                                </button>
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
