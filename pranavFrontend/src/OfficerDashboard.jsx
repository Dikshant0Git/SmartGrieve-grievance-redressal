import React, { useState, useEffect, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import api from './api';
import { useAuth } from './AuthContext';
import Heatmap from './Heatmap';
import {
    Bell,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    Cpu,
    Filter,
    Home,
    LayoutDashboard,
    MapPinned,
    MessageSquareText,
    Plus,
    ShieldCheck,
    Settings,
    Users,
    AlertCircle,
    Clock3,
    CircleCheckBig,
    CircleX,
    BadgeInfo,
    Search,
    Menu,
    X,
    LogOut,
    Activity,
    CheckCircle2,
    Zap,
    Clock,
    Play,
    Eye,
    Image as ImageIcon
} from 'lucide-react';

// Static sparks for visual consistency
const sparks = {
    blue: 'M4 18 C 12 15, 16 19, 24 11 S 36 8, 44 5 S 56 7, 64 4',
    amber: 'M4 17 C 11 18, 17 12, 24 13 S 36 10, 44 8 S 56 9, 64 6',
    indigo: 'M4 18 C 12 13, 15 20, 24 14 S 36 16, 44 9 S 56 12, 64 7',
    emerald: 'M4 16 C 12 15, 16 11, 24 13 S 36 9, 44 11 S 56 8, 64 5',
    rose: 'M4 15 C 11 16, 17 13, 24 17 S 36 12, 44 14 S 56 10, 64 13',
};

const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, active: true },
    { label: 'Complaints', icon: ClipboardList },
    { label: 'Heatmap', icon: MapPinned },
];

function toneClasses(tone) {
    const map = {
        blue: 'bg-slate-100 text-slate-700 ring-slate-200',
        amber: 'bg-amber-50 text-amber-700 ring-amber-200',
        indigo: 'bg-slate-100 text-slate-700 ring-slate-200',
        emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    };
    return map[tone] || map.blue;
}

function badgeClasses(kind) {
    const k = kind?.toLowerCase();
    const map = {
        'in progress': 'bg-slate-100 text-slate-700 ring-slate-200',
        'processing': 'bg-slate-100 text-slate-700 ring-slate-200',
        'pending': 'bg-slate-100 text-slate-700 ring-slate-200',
        'open': 'bg-slate-100 text-slate-700 ring-slate-200',
        'assigned': 'bg-slate-100 text-slate-700 ring-slate-200',
        'resolved': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        'under_review': 'bg-amber-50 text-amber-700 ring-amber-200',
        'review_required': 'bg-rose-50 text-rose-700 ring-rose-200',
        'rejected': 'bg-rose-50 text-rose-700 ring-rose-200',
        'escalated': 'bg-rose-50 text-rose-700 ring-rose-200',
        'high': 'bg-rose-50 text-rose-700 ring-rose-200',
        'critical': 'bg-rose-100 text-rose-900 ring-rose-300 font-bold',
        'medium': 'bg-slate-100 text-slate-700 ring-slate-200',
        'low': 'bg-slate-100 text-slate-600 ring-slate-200',
    };
    return map[k] || 'bg-slate-100 text-slate-700 ring-slate-200';
}

function StatCard({ item }) {
    const Icon = item.icon;
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm text-slate-500 font-medium">{item.label}</p>
                    <div className="mt-1 font-serif text-3xl font-bold tracking-tight text-slate-900">
                        {item.value}
                    </div>
                    <p className="mt-1 text-xs text-slate-400 font-medium">{item.meta}</p>
                </div>
                <div className={`rounded-xl p-2 ring-1 ${toneClasses(item.tone)}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <svg viewBox="0 0 68 24" className="mt-4 h-9 w-full text-slate-200" fill="none">
                <path d={item.spark} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
        </div>
    );
}

function StatusPill({ children, kind }) {
    return (
        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ${badgeClasses(kind)}`}>
            {children}
        </span>
    );
}

export default function OfficerDashboard() {
    const { user, logout } = useAuth();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [complaintsData, setComplaintsData] = useState([]);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const [currentView, setCurrentView] = useState('Dashboard');
    const [statusFilter, setStatusFilter] = useState('All');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [showMediaModal, setShowMediaModal] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        
        const fetchComplaints = async () => {
            try {
                const { data } = await api.get('/complaints/department');
                setComplaintsData(data.complaints);
                if (data.complaints.length > 0) setSelectedComplaint(data.complaints[0]);
            } catch (err) {
                console.error("Failed to fetch complaints:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchComplaints();

        const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', { withCredentials: true });
        
        socket.on('connect', () => {
            socket.emit('join_room', user.department);
        });

        socket.on('queue:new_complaint', (newC) => {
            setComplaintsData(prev => [newC, ...prev]);
        });

        socket.on('complaint:updated', (updatedC) => {
            setComplaintsData(prev => prev.map(c => c._id === updatedC._id ? updatedC : c));
            setSelectedComplaint(prev => prev?._id === updatedC._id ? updatedC : prev);
        });

        return () => socket.disconnect();
    }, [user]);

    // Handle click outside search
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return complaintsData.filter(c => 
            c.ai?.category?.[0]?.toLowerCase().includes(q) ||
            c.text?.toLowerCase().includes(q) ||
            `ward ${c.location?.ward}`.toLowerCase().includes(q) ||
            c.status?.toLowerCase().includes(q)
        ).slice(0, 5); // Show top 5 matches
    }, [searchQuery, complaintsData]);

    const stats = useMemo(() => {
        const total = complaintsData.length;
        const resolved = complaintsData.filter(c => c.status === 'resolved').length;
        const urgent = complaintsData.filter(c => c.ai?.urgency === 'High' || c.ai?.urgency === 'Critical').length;
        const pending = complaintsData.filter(c => c.status === 'Pending' || c.status === 'open').length;
        
        return [
            {
                label: 'Assigned Cases',
                value: total,
                meta: 'Total assigned to you',
                icon: Activity,
                tone: 'blue',
                spark: sparks.blue,
            },
            {
                label: 'Resolved',
                value: resolved,
                meta: `${total > 0 ? Math.round((resolved/total)*100) : 0}% success rate`,
                icon: CheckCircle2,
                tone: 'emerald',
                spark: sparks.emerald,
            },
            {
                label: 'Urgent',
                value: urgent,
                meta: 'Needs immediate action',
                icon: AlertCircle,
                tone: 'rose',
                spark: sparks.rose,
            },
            {
                label: 'Pending',
                value: pending,
                meta: 'Awaiting your review',
                icon: Clock,
                tone: 'amber',
                spark: sparks.amber,
            },
            {
                label: 'Response Goal',
                value: '< 4h',
                meta: 'Department SLA',
                icon: Zap,
                tone: 'indigo',
                spark: 'M2 12L10 16L18 8L26 10',
            },
        ];
    }, [complaintsData]);

    const handleUpdateStatus = async (status) => {
        if (!selectedComplaint) return;
        try {
            const { data } = await api.patch('/complaints/' + selectedComplaint._id + '/status', { status });
            // socket will handle the ui update, or we can optimistically update
            setSelectedComplaint(data.updatedComplaint);
            setComplaintsData(prev => prev.map(c => c._id === data.updatedComplaint._id ? data.updatedComplaint : c));
        } catch (err) {
            console.error("Update failed", err);
            alert("Failed to update status");
        }
    };

    return (
        <div className="min-h-screen bg-[#f3f4f6] text-slate-900 font-sans">
            {/* Mobile top bar */}
            <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900 backdrop-blur md:hidden">
                <div className="flex items-center justify-between px-4 py-3">
                    <button
                        onClick={() => setMobileNavOpen((v) => !v)}
                        className="rounded-xl border border-slate-700 p-2 text-slate-300"
                        aria-label="Toggle sidebar"
                    >
                        {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-sm font-semibold text-slate-900 shadow-sm">
                            O
                        </div>
                        <div>
                            <div className="text-sm font-semibold leading-none text-white font-serif">Officer Panel</div>
                            <div className="text-[11px] text-slate-400">City operations</div>
                        </div>
                    </div>
                    <div className="relative">
                        <Bell className="h-5 w-5 text-slate-300" />
                        <span className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-amber-500 px-1 text-[10px] leading-4 text-slate-900 font-bold">
                            3
                        </span>
                    </div>
                </div>
            </div>

            <div className="mx-auto flex max-w-[1600px] gap-0 md:gap-4">
                {/* Sidebar */}
                <aside
                    className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 transition-transform duration-300 md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                        }`}
                >
                    <div className="flex h-full flex-col">
                        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-900 shadow-sm">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="text-xl font-bold tracking-tight text-white font-serif">SmartGrieve</div>
                                <div className="text-xs text-slate-400">Officer Suite</div>
                            </div>
                        </div>

                        <nav className="flex-1 px-4 py-6 flex flex-col">
                            <div className="space-y-1">
                                {['Dashboard', 'Complaints', 'Heatmap'].map((label) => {
                                    const item = menuItems.find(m => m.label === label);
                                    const Icon = item.icon;
                                    const active = currentView === label;
                                    return (
                                        <button
                                            key={label}
                                            onClick={() => {
                                                setCurrentView(label);
                                                setMobileNavOpen(false);
                                            }}
                                            className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors font-medium ${active
                                                ? 'bg-amber-500 text-slate-900 shadow-sm'
                                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                                }`}
                                        >
                                            <Icon className={`h-5 w-5 ${active ? 'text-slate-900' : 'text-slate-500'}`} />
                                            <span className="text-sm">{label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="p-4 mt-auto rounded-xl bg-slate-800/50 border border-slate-700/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center shrink-0 text-slate-900 font-bold shadow-sm">
                                        {user?.name?.charAt(0) || 'O'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{user?.name || 'Officer'}</p>
                                        <p className="text-xs text-slate-400 truncate uppercase tracking-wider mt-0.5">{user?.role === 'admin' ? 'Admin' : user?.department ? 'Dept: ' + user.department : 'Civic Officer'}</p>
                                    </div>
                                </div>
                                <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all">
                                    <LogOut size={16} /><span>Logout</span>
                                </button>
                            </div>
                        </nav>
                    </div>
                </aside>

                {/* Backdrop on mobile */}
                {mobileNavOpen && (
                    <button
                        aria-label="Close sidebar overlay"
                        onClick={() => setMobileNavOpen(false)}
                        className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
                    />
                )}

                {/* Main content */}
                <main className="min-w-0 flex-1 px-4 py-4 md:px-5 md:py-5 lg:px-6 lg:py-6">
                    {/* Top header */}
                    <header className="hidden items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm md:flex">
                        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                            <MapPinned className="h-4 w-4 text-amber-500" /> Bhopal
                        </div>

                        <div className="flex w-full max-w-xl items-center gap-3 px-6 relative" ref={searchRef}>
                            <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:bg-white transition-all">
                                <Search className="h-4 w-4 text-slate-400" />
                                <input
                                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                                    placeholder="Search complaints, wards, categories..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setIsSearchOpen(true);
                                    }}
                                    onFocus={() => setIsSearchOpen(true)}
                                />
                            </div>

                            {/* Search Results Dropdown */}
                            {isSearchOpen && searchQuery.trim() !== '' && (
                                <div className="absolute top-[calc(100%+8px)] left-6 right-6 z-[100] rounded-xl border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                                    {searchResults.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            {searchResults.map((res) => (
                                                <button
                                                    key={res._id}
                                                    onClick={() => {
                                                        setSelectedComplaint(res);
                                                        setSearchQuery('');
                                                        setIsSearchOpen(false);
                                                        setCurrentView('Dashboard');
                                                    }}
                                                    className="flex items-center gap-3 rounded-lg p-3 text-left transition hover:bg-slate-50 group"
                                                >
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-slate-900 group-hover:text-amber-500 transition-colors">
                                                        <ClipboardList className="h-5 w-5" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-sm font-bold text-slate-900 truncate">{res.ai?.category?.[0]}</div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Ward {res.location?.ward}</div>
                                                        </div>
                                                        <div className="text-xs text-slate-500 truncate mt-0.5">{res.text}</div>
                                                    </div>
                                                </button>
                                            ))}
                                            <div className="p-2 border-t border-slate-100 mt-1">
                                                <button 
                                                    onClick={() => {
                                                        setCurrentView('Complaints');
                                                        setIsSearchOpen(false);
                                                    }}
                                                    className="w-full py-2 text-[11px] font-bold text-slate-900 uppercase tracking-wider hover:bg-slate-50 rounded-lg transition"
                                                >
                                                    View all results in Queue
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center">
                                            <div className="text-sm font-bold text-slate-800">No matches found</div>
                                            <div className="text-xs text-slate-400 mt-1">Try searching by ward, category, or status</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button className="rounded-lg border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 relative group">
                                <Bell className="h-4 w-4" />
                                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-500 border-2 border-white" />
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-sm font-bold leading-none text-slate-900">{user?.name || 'User'}</div>
                                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">{user?.role || 'Officer'}</div>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-amber-500 shadow-sm">
                                {user?.name?.charAt(0) || 'A'}
                            </div>
                        </div>
                    </header>

                    {/* Main Content Area */}
                    <div className="mt-6">
                        {currentView === 'Dashboard' && (
                            <>
                                {/* Hero row */}
                                <section className="grid gap-6 lg:w-full">
                                    <div className="overflow-hidden rounded-2xl bg-slate-900 p-8 shadow-sm">
                                        <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
                                            <div className="max-w-2xl">
                                                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl font-serif">
                                                    Welcome back, {user?.name || 'Admin'} <span className="ml-1 align-middle">👋</span>
                                                </h2>
                                                <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300">
                                                    Manage citizen complaints, monitor departments and oversee operations — all from one place.
                                                </p>
                                                <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
                                                    <div className="rounded-lg bg-slate-800/80 px-4 py-2 border border-slate-700/50 font-medium"><span className="text-slate-400 font-bold mr-1">City</span> Bhopal</div>
                                                    <div className="rounded-lg bg-slate-800/80 px-4 py-2 border border-slate-700/50 font-medium"><span className="text-slate-400 font-bold mr-1">Role</span> Officer</div>
                                                    <div className="rounded-lg bg-slate-800/80 px-4 py-2 border border-slate-700/50 font-medium"><span className="text-slate-400 font-bold mr-1">Total</span> {complaintsData.length} complaints</div>
                                                </div>
                                            </div>

                                            <div className="relative min-h-[170px] w-full xl:max-w-[400px] overflow-hidden rounded-2xl bg-[url('.././public/map.avif')] border border-white/50 p-6 shadow-sm">
                                                <div className="relative flex flex-col h-full justify-between gap-4">
                                                    <div>
                                                        <div className="text-xl font-bold text-white font-serif">City snapshot</div>
                                                        <p className="mt-2 text-sm leading-relaxed text-white font-medium">
                                                            Monitor complaint clusters and track resolution patterns at a glance instantly.
                                                        </p>
                                                    </div>
                                                    <button onClick={() => setCurrentView('Heatmap')} className="self-start mt-4 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-bold shadow-sm hover:bg-slate-800 transition-all">
                                                        <MapPinned className="h-4 w-4 text-amber-500" /> View Heatmap
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Stats row */}
                                <section className="mt-6 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                                    {stats.map((item) => (
                                        <StatCard key={item.label} item={item} />
                                    ))}
                                </section>

                                {/* Content Grid */}
                                <section className="my-6 grid gap-6 grid-cols-1 xl:grid-cols-[1fr_400px]">
                                    {/* Left: Enhanced Table */}
                                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[800px]">
                                        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between bg-white">
                                            <div>
                                                <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-serif">Recent Complaints</h3>
                                            </div>
                                            <button onClick={() => { setCurrentView('Complaints'); setStatusFilter('All'); }} className="group flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                                                View all <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-auto custom-scrollbar p-6 pt-0">
                                            <div className="space-y-3 mt-4">
                                                {loading ? (
                                                    <div className="p-12 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-100 border-t-amber-500" />
                                                            <span className="text-sm font-medium text-slate-400">Loading assignments...</span>
                                                        </div>
                                                    </div>
                                                ) : complaintsData.length === 0 ? (
                                                    <div className="p-12 text-center text-slate-400 font-medium">No complaints assigned to you yet.</div>
                                                ) : complaintsData.slice(0, 10).map((item) => (
                                                    <div 
                                                        key={item._id} 
                                                        onClick={() => setSelectedComplaint(item)} 
                                                        className={`group cursor-pointer transition-all duration-200 rounded-xl border p-4 flex items-center justify-between ${selectedComplaint?._id === item._id ? 'border-amber-500 bg-amber-50/30' : 'border-slate-100 hover:border-slate-300'}`}
                                                    >
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-slate-900 text-sm">{item.citizen?.name || item.citizenName || 'Anonymous'}</span>
                                                                {(item.source?.toLowerCase() === 'whatsapp' || item.whatsappMessageIds?.length > 0) && (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 ring-1 ring-emerald-200 shadow-sm">
                                                                        <MessageSquareText className="h-2.5 w-2.5" />
                                                                        WhatsApp
                                                                    </span>
                                                                )}
                                                                <span className="text-slate-300">·</span>
                                                                <span className="text-sm text-slate-500">{item.ai?.category?.[0] || 'Pending Analysis'}</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <StatusPill kind={item.status}>{item.status.replace('_', ' ')}</StatusPill>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Uplifted Case Details */}
                                    <aside className="flex flex-col h-[800px]">
                                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-full">
                                            <div className="p-6 border-b border-slate-100 bg-white">
                                                <h3 className="font-bold text-slate-900 text-2xl font-serif">Complaint Detail</h3>
                                            </div>
                                            
                                            <div className="flex-1 p-6 overflow-y-auto">
                                                {selectedComplaint ? (
                                                    <div className="space-y-6">
                                                        {/* Details List */}
                                                        <div className="space-y-5">
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Citizen</div>
                                                                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                                                                    <div className="text-sm font-semibold text-slate-900">{selectedComplaint.citizen?.name || selectedComplaint.citizenName || 'Anonymous'}</div>
                                                                    {(selectedComplaint.source?.toLowerCase() === 'whatsapp' || selectedComplaint.whatsappMessageIds?.length > 0) && (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200 shadow-sm">
                                                                            <MessageSquareText className="h-3 w-3" />
                                                                            WhatsApp
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Status</div>
                                                                <div className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100">{selectedComplaint.status}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Priority</div>
                                                                <div className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100">{selectedComplaint.ai?.urgency || '—'}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Department</div>
                                                                <div className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100">{selectedComplaint.ai?.category?.[0] || '—'}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Location</div>
                                                                <div className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100">Ward {selectedComplaint.location?.ward || '—'}, Bhopal</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Description</div>
                                                                <p className="text-sm text-slate-600 leading-relaxed pt-1">
                                                                    {selectedComplaint.text}
                                                                </p>
                                                            </div>

                                                            {/* Media Evidence Button */}
                                                            <div className="pt-4 mt-2">
                                                                {selectedComplaint.media?.length > 0 ? (
                                                                    <button 
                                                                        onClick={() => setShowMediaModal(true)}
                                                                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-100 transition shadow-sm"
                                                                    >
                                                                        <ImageIcon size={14} /> View Evidence Files ({selectedComplaint.media.length})
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 text-xs font-medium cursor-not-allowed">
                                                                        No Evidence Attached
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Media Modal */}
                                                        {showMediaModal && selectedComplaint.media?.length > 0 && (
                                                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                                                                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                                                                    <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                                                        <div>
                                                                            <h3 className="text-xl font-bold text-slate-900 font-serif">Grievance Evidence</h3>
                                                                            <p className="text-xs text-slate-500 mt-1">Files attached to #{selectedComplaint.grievanceId}</p>
                                                                        </div>
                                                                        <button 
                                                                            onClick={() => setShowMediaModal(false)}
                                                                            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                                                                        >
                                                                            <X size={20} className="text-slate-500" />
                                                                        </button>
                                                                    </div>
                                                                    <div className="flex-1 overflow-y-auto p-6">
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                            {selectedComplaint.media.map((m, idx) => (
                                                                                <div key={idx} className="space-y-2">
                                                                                    <div className="relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200 aspect-video group">
                                                                                        {m.video_url || m.type === 'video' ? (
                                                                                            <video src={m.video_url} controls className="w-full h-full object-contain bg-black" />
                                                                                        ) : (
                                                                                            <img src={m.image_url} alt="Evidence" className="w-full h-full object-contain" />
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="flex items-center justify-between px-1">
                                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">File {idx + 1} • {m.video_url || m.type === 'video' ? 'Video' : 'Image'}</span>
                                                                                        <a href={m.video_url || m.image_url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-amber-600 hover:underline">Download Original</a>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                                                                        <button 
                                                                            onClick={() => setShowMediaModal(false)}
                                                                            className="px-6 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition"
                                                                        >
                                                                            Close Preview
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* AI Insights Snippet */}
                                                        <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 mt-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Cpu className="h-4 w-4 text-amber-500" />
                                                                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-700">AI Insights & Confidence: {(selectedComplaint.ai?.confidence * 100 || 85).toFixed(0)}%</span>
                                                            </div>
                                                            {selectedComplaint.ai?.summary ? (
                                                                <div className="space-y-2">
                                                                    <p className="text-xs font-bold text-slate-800">AI Summary:</p>
                                                                    <p className="text-xs text-slate-600 leading-relaxed italic underline-offset-2 decoration-amber-200/50">
                                                                        "{selectedComplaint.ai.summary}"
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-slate-500 leading-relaxed">
                                                                    Automated classification logged. AI suggests this maps to {selectedComplaint.ai?.category?.[0]} protocols.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                                                        <ClipboardList className="h-12 w-12 mb-4 opacity-50" />
                                                        <h4 className="text-lg font-bold text-slate-700 font-serif">Select a case</h4>
                                                        <p className="text-sm mt-2">Review details by picking a grievance from the list.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Footer */}
                                            {selectedComplaint && (
                                                <div className="p-6 bg-white border-t border-slate-100 space-y-3">
                                                    <button 
                                                        onClick={() => handleUpdateStatus('resolved')}
                                                        className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition"
                                                    >
                                                        Mark as Resolved
                                                    </button>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <button 
                                                            onClick={() => handleUpdateStatus('under_review')}
                                                            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                                                        >
                                                            Under Review
                                                        </button>
                                                        <button 
                                                            onClick={() => handleUpdateStatus('escalated')}
                                                            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                                                        >
                                                            Escalate
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </aside>
                                </section>
                            </>
                        )}

                        {currentView === 'Complaints' && (
                            <div className="space-y-6">
                                <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-serif">Department Queue</h2>
                                            <p className="text-slate-500 mt-2">
                                                {statusFilter === 'review_required' ? 'Showing complaints requiring immediate officer review.' : `Complete list of grievances for ${user?.department}.`}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {['All', 'open', 'under_review', 'review_required', 'resolved'].map((f) => (
                                                <button
                                                    key={f}
                                                    onClick={() => setStatusFilter(f)}
                                                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition border ${statusFilter === f 
                                                        ? 'bg-slate-900 text-white border-slate-900' 
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    {f.replace('_', ' ').charAt(0).toUpperCase() + f.replace('_', ' ').slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto max-h-[750px] overflow-y-auto custom-scrollbar p-6">
                                        <table className="min-w-[1000px] w-full text-left border-separate border-spacing-y-3">
                                            <thead className="text-[10px] uppercase tracking-widest text-slate-400 font-bold sticky top-0 z-10 bg-white">
                                                <tr>
                                                    <th className="px-4 py-2 pb-4">Complaint Detail</th>
                                                    <th className="px-4 py-2 pb-4 text-center">Status</th>
                                                    <th className="px-4 py-2 pb-4 text-center">Priority</th>
                                                    <th className="px-4 py-2 pb-4">Ward</th>
                                                    <th className="px-4 py-2 pb-4">Filed Date</th>
                                                    <th className="px-4 py-2 pb-4" />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loading ? (
                                                    <tr><td colSpan="6" className="p-10 text-center text-slate-500">Loading complaints...</td></tr>
                                                ) : (statusFilter === 'All' ? complaintsData : complaintsData.filter(c => c.status === statusFilter)).length === 0 ? (
                                                    <tr><td colSpan="6" className="p-10 text-center text-slate-500">No complaints match this filter.</td></tr>
                                                ) : (statusFilter === 'All' ? complaintsData : complaintsData.filter(c => c.status === statusFilter)).map((item) => (
                                                    <tr 
                                                        key={item._id} 
                                                        onClick={() => {
                                                            setSelectedComplaint(item);
                                                            setCurrentView('Dashboard');
                                                        }}
                                                        className="group cursor-pointer transition hover:bg-slate-50"
                                                    >
                                                        <td className="px-4 py-4 border-y border-l rounded-l-xl border-slate-100 group-hover:border-slate-200">
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-semibold text-slate-900 text-sm">{item.ai?.category?.[0] || 'Grievance'}</div>
                                                                {(item.source?.toLowerCase() === 'whatsapp' || item.whatsappMessageIds?.length > 0) && (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 ring-1 ring-emerald-200 shadow-sm">
                                                                        <MessageSquareText className="h-2.5 w-2.5" />
                                                                        WhatsApp
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="mt-1 max-w-sm text-xs text-slate-500 truncate">{item.text}</div>
                                                        </td>
                                                        <td className="px-4 py-4 border-y border-slate-100 group-hover:border-slate-200">
                                                            <div className="flex justify-center">
                                                                <StatusPill kind={item.status}>{item.status.replace('_', ' ')}</StatusPill>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 border-y border-slate-100 group-hover:border-slate-200">
                                                            <div className="flex justify-center">
                                                                <StatusPill kind={item.ai?.urgency || 'Medium'}>{item.ai?.urgency || 'Medium'}</StatusPill>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 border-y border-slate-100 group-hover:border-slate-200 text-sm font-semibold text-slate-700">Ward {item.location?.ward || '—'}</td>
                                                        <td className="px-4 py-4 border-y border-slate-100 group-hover:border-slate-200 text-sm text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</td>
                                                        <td className="px-4 py-4 border-y border-r rounded-r-xl border-slate-100 group-hover:border-slate-200 text-right">
                                                            <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-amber-500 inline-block" />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentView === 'Heatmap' && (
                            <div className="space-y-6">
                                <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                                    <h2 className="text-3xl font-bold font-serif text-slate-900">City Analytics Heatmap</h2>
                                    <p className="text-slate-500 mt-2">Visualizing complaint density and response pressure across Bhopal.</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <Heatmap height="700px" />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="text-xl font-bold tracking-tight text-slate-900 font-serif">Quick Actions</h3>
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                ['Review Queue', Filter, 'Complaints', 'review_required'],
                                ['Open Heatmap', MapPinned, 'Heatmap', 'All'],
                            ].map(([label, Icon, view, filter]) => (
                                <button
                                    key={label}
                                    onClick={() => {
                                        setCurrentView(view);
                                        if (filter) setStatusFilter(filter);
                                    }}
                                    className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:bg-white hover:shadow-md hover:border-amber-500/30 group"
                                >
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-amber-500 shadow-sm group-hover:bg-amber-500 group-hover:text-slate-900 transition-all">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="mt-4 text-sm font-bold text-slate-900">{label}</div>
                                    <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Jump to view</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}