import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import api from './api';
import { toast } from 'react-toastify';

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-focus next
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`).focus();
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setMaskedEmail(data.email);
      setStep(2);
      toast.info("OTP sent to your email");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/verify-forgot-otp', { 
        email, 
        otp: otp.join('') 
      });
      setResetToken(data.resetToken);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setError("Passwords do not match");
      return;
    }
    
    // Simple validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(passwords.new)) {
      setError("Password must be at least 8 characters, include one uppercase letter and one number.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', {
        email,
        resetToken,
        newPassword: passwords.new
      });
      toast.success("Password reset successful!");
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-100 flex">
          <div className={`h-full transition-all duration-500 bg-amber-500 ${step >= 1 ? 'w-1/3' : 'w-0'}`}></div>
          <div className={`h-full transition-all duration-500 bg-amber-500 ${step >= 2 ? 'w-1/3' : 'w-0'}`}></div>
          <div className={`h-full transition-all duration-500 bg-amber-500 ${step >= 3 ? 'w-1/3' : 'w-0'}`}></div>
        </div>

        <div className="p-8">
          <button 
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/login')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors mb-8"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {step === 1 && "Forgot Password"}
              {step === 2 && "Enter OTP"}
              {step === 3 && "Set New Password"}
            </h1>
            <p className="text-slate-500 text-sm">
              {step === 1 && "Enter your email address and we'll send you a code to reset your password."}
              {step === 2 && `We've sent a 6-digit code to ${maskedEmail || email}.`}
              {step === 3 && "Almost there! Create a strong new password for your account."}
            </p>
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm font-medium border border-rose-100 mb-6">
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Registered Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. citizen@gmail.com"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>
              <button 
                disabled={loading || !email}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-70 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Send Reset Code"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-8">
              <div className="flex justify-between gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    maxLength="1"
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
                  />
                ))}
              </div>
              <button 
                disabled={loading || otp.some(d => !d)}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-70 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Verify OTP"}
                {!loading && <ShieldCheck size={18} />}
              </button>
              <div className="text-center">
                <button 
                  type="button"
                  onClick={handleSendOtp}
                  className="text-amber-600 text-sm font-bold hover:underline"
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      required
                      value={passwords.new}
                      onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                      placeholder="••••••••"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      required
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                      placeholder="••••••••"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
              </div>
              <button 
                disabled={loading || !passwords.new || !passwords.confirm}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-70 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
              >
                {loading ? <Loader2 className="animate-spin" /> : "Update Password"}
                {!loading && <CheckCircle size={18} />}
              </button>
            </form>
          )}

          <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400 text-xs font-medium">
            <ShieldCheck size={14} /> 
            <span>Step {step} of 3 • Secure Reset</span>
          </div>
        </div>
      </div>
    </div>
  );
}
