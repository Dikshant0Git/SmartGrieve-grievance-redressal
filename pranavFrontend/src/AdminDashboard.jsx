import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  UserPlus,
  LogOut,
  User,
  Search,
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Plus,
  ChevronRight,
  Play,
  Activity,
  Building2,
  Trophy,
  Users,
  Star,
  Loader2,
} from "lucide-react";
import API from "./api";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Heatmap from "./Heatmap";
import { useAuth } from "./AuthContext";

/* ─── Google Font injection ─────────────────────────────────────────────────── */
const FontStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --navy:    #0f1623;
      --navy2:   #162032;
      --navy3:   #1e2d42;
      --slate:   #2a3d57;
      --border:  rgba(255,255,255,0.07);
      --text:    #f0f4f8;
      --muted:   #7a9bbf;
      --amber:   #f5a623;
      --green:   #3ecf8e;
      --red:     #f25c5c;
      --blue:    #4da6ff;
      --white:   #ffffff;
      --card-bg: #ffffff;
      --card-border: #e8edf2;
      --card-text: #1a2332;
      --card-muted: #6b7e96;
    }

    body { font-family: 'DM Sans', sans-serif; }

    .sg-app {
      display: flex;
      min-height: 100vh;
      background: #f0f4f8;
      font-family: 'DM Sans', sans-serif;
    }

    /* ── Sidebar ──────────────────────────────────────────────────────────── */
    .sg-sidebar {
      width: 260px;
      min-height: 100vh;
      background: var(--navy);
      position: fixed;
      left: 0; top: 0; bottom: 0;
      display: flex;
      flex-direction: column;
      padding: 28px 16px;
      border-right: 1px solid var(--border);
      z-index: 100;
    }

    .sg-logo {
      font-family: 'DM Serif Display', serif;
      font-size: 22px;
      color: var(--white);
      padding: 0 12px;
      margin-bottom: 36px;
      letter-spacing: -0.3px;
    }

    .sg-logo span { color: var(--amber); }

    .sg-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }

    .sg-nav-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      border-radius: 10px;
      border: none;
      background: transparent;
      color: var(--muted);
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.18s ease;
      text-align: left;
      width: 100%;
    }

    .sg-nav-btn:hover { background: var(--navy3); color: var(--text); }

    .sg-nav-btn.active {
      background: var(--amber);
      color: var(--navy);
      font-weight: 600;
    }

    .sg-nav-btn.active svg { color: var(--navy); }

    .sg-logout {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      border-radius: 10px;
      border: none;
      background: transparent;
      color: #f25c5c99;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.18s;
      text-align: left;
      width: 100%;
      margin-top: 8px;
    }

    .sg-logout:hover { background: rgba(242,92,92,0.1); color: var(--red); }

    .sg-sidebar-footer {
      padding: 16px 14px 0;
      border-top: 1px solid var(--border);
      margin-top: 16px;
    }

    .sg-sidebar-user {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .sg-avatar {
      width: 36px; height: 36px;
      border-radius: 10px;
      background: var(--amber);
      color: var(--navy);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700;
      font-size: 15px;
      flex-shrink: 0;
    }

    .sg-sidebar-user-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
    }

    .sg-sidebar-user-role {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ── Main ─────────────────────────────────────────────────────────────── */
    .sg-main {
      margin-left: 260px;
      flex: 1;
      padding: 24px 28px;
      min-height: 100vh;
    }

    /* ── Topbar ───────────────────────────────────────────────────────────── */
    .sg-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--white);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 14px 20px;
      margin-bottom: 24px;
    }

    .sg-topbar-loc {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: var(--card-muted);
    }

    .sg-topbar-loc svg { color: var(--amber); }

    .sg-topbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sg-topbar-avatar {
      width: 38px; height: 38px;
      border-radius: 10px;
      background: var(--navy);
      color: var(--amber);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700;
      font-size: 15px;
    }

    .sg-topbar-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--card-text);
    }

    .sg-topbar-role {
      font-size: 11px;
      color: var(--card-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ── Section title ────────────────────────────────────────────────────── */
    .sg-section-title {
      font-family: 'DM Serif Display', serif;
      font-size: 26px;
      color: var(--card-text);
      margin-bottom: 4px;
    }

    .sg-section-sub {
      font-size: 13px;
      color: var(--card-muted);
      margin-bottom: 22px;
    }

    /* ── Welcome banner ───────────────────────────────────────────────────── */
    .sg-welcome {
      background: var(--navy);
      border-radius: 18px;
      padding: 32px 36px;
      color: var(--text);
      position: relative;
      overflow: hidden;
      flex: 1;
    }

    .sg-welcome::before {
      content: '';
      position: absolute;
      right: -40px; top: -40px;
      width: 200px; height: 200px;
      border-radius: 50%;
      background: rgba(245,166,35,0.08);
      pointer-events: none;
    }

    .sg-welcome::after {
      content: '';
      position: absolute;
      right: 60px; bottom: -60px;
      width: 160px; height: 160px;
      border-radius: 50%;
      background: rgba(77,166,255,0.06);
      pointer-events: none;
    }

    .sg-welcome h2 {
      font-family: 'DM Serif Display', serif;
      font-size: 24px;
      font-weight: 400;
      margin-bottom: 8px;
    }

    .sg-welcome p { font-size: 13px; color: var(--muted); line-height: 1.6; max-width: 420px; }

    .sg-welcome-meta {
      display: flex;
      gap: 20px;
      margin-top: 20px;
    }

    .sg-welcome-chip {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 12px;
      color: var(--muted);
    }

    .sg-welcome-chip b { color: var(--text); }

    /* ── Quick action card ────────────────────────────────────────────────── */
    .sg-quick-card {
      background: var(--amber);
      border-radius: 18px;
      padding: 28px 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 220px;
    }

    .sg-quick-card h3 {
      font-family: 'DM Serif Display', serif;
      font-size: 19px;
      color: var(--navy);
      margin-bottom: 8px;
      line-height: 1.3;
    }

    .sg-quick-card p { font-size: 12px; color: rgba(15,22,35,0.65); margin-bottom: 20px; }

    .sg-quick-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: var(--navy);
      color: var(--amber);
      border: none;
      border-radius: 10px;
      padding: 11px;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .sg-quick-btn:hover { opacity: 0.88; }

    /* ── Stat card ────────────────────────────────────────────────────────── */
    .sg-stat-card {
      background: var(--white);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .sg-stat-value {
      font-family: 'DM Serif Display', serif;
      font-size: 32px;
      color: var(--card-text);
      line-height: 1;
    }

    .sg-stat-label {
      font-size: 12px;
      color: var(--card-muted);
      margin-top: 4px;
      font-weight: 500;
    }

    .sg-stat-icon {
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    /* ── Card ─────────────────────────────────────────────────────────────── */
    .sg-card {
      background: var(--white);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 24px;
    }

    .sg-card-title {
      font-family: 'DM Serif Display', serif;
      font-size: 18px;
      color: var(--card-text);
      margin-bottom: 18px;
    }

    /* ── Complaint row ────────────────────────────────────────────────────── */
    .sg-complaint-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid var(--card-border);
      cursor: pointer;
      transition: all 0.15s;
      margin-bottom: 10px;
    }

    .sg-complaint-row:hover { border-color: var(--amber); background: #fffdf7; }

    .sg-complaint-row:last-child { margin-bottom: 0; }

    .sg-complaint-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--card-text);
    }

    .sg-complaint-meta {
      font-size: 12px;
      color: var(--card-muted);
      margin-top: 3px;
    }

    /* ── Status badge ─────────────────────────────────────────────────────── */
    .sg-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .badge-pending   { background: #fff7e6; color: #c87d00; }
    .badge-assigned  { background: #e8f0fe; color: #1a56db; }
    .badge-progress  { background: #e8f4fd; color: #0a84c7; }
    .badge-resolved  { background: #e6faf2; color: #1a8f5e; }
    .badge-rejected  { background: #fdecea; color: #c0392b; }
    .badge-default   { background: #f0f4f8; color: #6b7e96; }

    /* ── Detail panel ─────────────────────────────────────────────────────── */
    .sg-detail-row {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 0;
      border-bottom: 1px solid var(--card-border);
    }

    .sg-detail-row:last-child { border-bottom: none; }

    .sg-detail-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--card-muted);
    }

    .sg-detail-value {
      font-size: 13px;
      font-weight: 500;
      color: var(--card-text);
    }

    /* ── Table ────────────────────────────────────────────────────────────── */
    .sg-table-wrap { overflow-x: auto; }

    .sg-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .sg-table thead tr {
      background: #f8fafc;
    }

    .sg-table th {
      padding: 12px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--card-muted);
      border-bottom: 1px solid var(--card-border);
    }

    .sg-table td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--card-border);
      color: var(--card-text);
      vertical-align: middle;
    }

    .sg-table tbody tr:hover { background: #fafcff; }

    .sg-table tbody tr:last-child td { border-bottom: none; }

    /* ── Inputs ───────────────────────────────────────────────────────────── */
    .sg-input {
      width: 100%;
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 11px 14px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      color: var(--card-text);
      background: #fff;
      outline: none;
      transition: border-color 0.15s;
    }

    .sg-input:focus { border-color: var(--amber); }

    .sg-input::placeholder { color: #b0bec5; }

    .sg-select {
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 11px 14px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      color: var(--card-text);
      background: #fff;
      outline: none;
      cursor: pointer;
      transition: border-color 0.15s;
    }

    .sg-select:focus { border-color: var(--amber); }

    /* ── Buttons ──────────────────────────────────────────────────────────── */
    .sg-btn-primary {
      background: var(--navy);
      color: var(--white);
      border: none;
      border-radius: 10px;
      padding: 11px 20px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .sg-btn-primary:hover { opacity: 0.85; }

    .sg-btn-outline {
      background: transparent;
      color: var(--card-text);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 10px 18px;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .sg-btn-outline:hover { background: #f0f4f8; }

    .sg-btn-amber {
      background: var(--amber);
      color: var(--navy);
      border: none;
      border-radius: 10px;
      padding: 11px 20px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .sg-btn-amber:hover { opacity: 0.88; }

    /* ── Search bar ───────────────────────────────────────────────────────── */
    .sg-search-wrap {
      position: relative;
    }

    .sg-search-wrap svg {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #b0bec5;
    }

    .sg-search-wrap input {
      padding-left: 38px;
    }

    /* ── Profile item ─────────────────────────────────────────────────────── */
    .sg-profile-item {
      background: #f8fafc;
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 16px 20px;
    }

    .sg-profile-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--card-muted);
      margin-bottom: 4px;
    }

    .sg-profile-value {
      font-size: 15px;
      font-weight: 600;
      color: var(--card-text);
    }

    /* ── Modal ────────────────────────────────────────────────────────────── */
    .sg-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(10,16,28,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      backdrop-filter: blur(3px);
    }

    .sg-modal {
      background: var(--white);
      border-radius: 20px;
      padding: 32px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.18);
    }

    .sg-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .sg-modal-title {
      font-family: 'DM Serif Display', serif;
      font-size: 22px;
      color: var(--card-text);
    }

    .sg-modal-close {
      background: #f0f4f8;
      border: none;
      border-radius: 8px;
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      color: var(--card-muted);
      transition: background 0.15s;
    }

    .sg-modal-close:hover { background: #e2e8f0; color: var(--card-text); }

    /* ── Department card ──────────────────────────────────────────────────── */
    .sg-dept-card {
      background: var(--white);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 22px;
      transition: box-shadow 0.18s, border-color 0.18s;
      position: relative;
      overflow: hidden;
    }

    .sg-dept-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: var(--amber);
      border-radius: 16px 16px 0 0;
    }

    .sg-dept-card:hover {
      box-shadow: 0 8px 32px rgba(0,0,0,0.09);
      border-color: #d0dae6;
    }

    .sg-dept-name {
      font-family: 'DM Serif Display', serif;
      font-size: 17px;
      color: var(--card-text);
      margin-bottom: 3px;
    }

    .sg-dept-code {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      background: #f0f4f8;
      color: var(--card-muted);
      padding: 3px 8px;
      border-radius: 6px;
      margin-bottom: 16px;
    }

    .sg-dept-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }

    .sg-dept-stat {
      background: #f8fafc;
      border-radius: 10px;
      padding: 10px 8px;
      text-align: center;
    }

    .sg-dept-stat-val {
      font-family: 'DM Serif Display', serif;
      font-size: 20px;
      color: var(--card-text);
      line-height: 1;
    }

    .sg-dept-stat-lbl {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--card-muted);
      margin-top: 3px;
    }

    .sg-dept-officers-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--card-muted);
      margin-bottom: 8px;
    }

    .sg-officer-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 8px;
      background: #f8fafc;
      margin-bottom: 6px;
    }

    .sg-officer-pill:last-child { margin-bottom: 0; }

    .sg-officer-avatar {
      width: 28px; height: 28px;
      border-radius: 8px;
      background: var(--navy);
      color: var(--amber);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .sg-officer-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--card-text);
    }

    .sg-officer-dept {
      font-size: 11px;
      color: var(--card-muted);
    }

    /* ── Leaderboard ──────────────────────────────────────────────────────── */
    .sg-leaderboard-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid var(--card-border);
      margin-bottom: 10px;
      transition: border-color 0.15s;
    }

    .sg-leaderboard-row:hover { border-color: var(--amber); }
    .sg-leaderboard-row:last-child { margin-bottom: 0; }

    .sg-rank {
      font-family: 'DM Serif Display', serif;
      font-size: 22px;
      color: var(--card-muted);
      min-width: 32px;
      text-align: center;
    }

    .sg-rank-1 { color: #f5a623; }
    .sg-rank-2 { color: #94a3b8; }
    .sg-rank-3 { color: #c07b4a; }

    .sg-lb-bar-wrap {
      flex: 1;
    }

    .sg-lb-dept-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--card-text);
      margin-bottom: 5px;
    }

    .sg-lb-bar-bg {
      background: #f0f4f8;
      border-radius: 99px;
      height: 6px;
      overflow: hidden;
    }

    .sg-lb-bar-fill {
      height: 6px;
      border-radius: 99px;
      background: var(--amber);
      transition: width 0.6s ease;
    }

    .sg-lb-resolved {
      font-family: 'DM Serif Display', serif;
      font-size: 22px;
      color: var(--card-text);
      min-width: 48px;
      text-align: right;
    }

    .sg-lb-resolved-lbl {
      font-size: 10px;
      color: var(--card-muted);
      text-align: right;
    }

    /* ── Grid helpers ─────────────────────────────────────────────────────── */
    .sg-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
    .sg-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .sg-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
    .sg-flex   { display: flex; }
    .sg-flex-col { display: flex; flex-direction: column; }
    .gap-4 { gap: 16px; }
    .gap-3 { gap: 12px; }
    .mb-4 { margin-bottom: 16px; }
    .mb-6 { margin-bottom: 24px; }

    @media (max-width: 1100px) {
      .sg-grid-4 { grid-template-columns: repeat(2,1fr); }
    }
  `}</style>
);

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
function statusBadgeClass(status) {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "pending":
    case "open":
      return "sg-badge badge-pending";
    case "assigned":
      return "sg-badge badge-assigned";
    case "in progress":
    case "processing":
    case "under_review":
      return "sg-badge badge-progress";
    case "resolved":
      return "sg-badge badge-resolved";
    case "rejected":
      return "sg-badge badge-rejected";
    case "review_required":
    case "escalated":
      return "sg-badge badge-assigned";
    default:
      return "sg-badge badge-default";
  }
}

function statIconStyle(color, bg) {
  return { backgroundColor: bg, color };
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */
const SidebarBtn = ({ icon: Icon, label, tab, active, onClick }) => (
  <button className={`sg-nav-btn ${active ? "active" : ""}`} onClick={() => onClick(tab)}>
    <Icon size={17} />
    {label}
  </button>
);

const StatCard = ({ title, value, icon: Icon, iconColor, iconBg }) => (
  <div className="sg-stat-card">
    <div>
      <div className="sg-stat-value">{value}</div>
      <div className="sg-stat-label">{title}</div>
    </div>
    <div className="sg-stat-icon" style={statIconStyle(iconColor, iconBg)}>
      <Icon size={20} />
    </div>
  </div>
);

const ProfileItem = ({ label, value }) => (
  <div className="sg-profile-item">
    <div className="sg-profile-label">{label}</div>
    <div className="sg-profile-value">{value || "—"}</div>
  </div>
);

/* ─── Main Component ─────────────────────────────────────────────────────────── */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [admin, setAdmin] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showOfficerModal, setShowOfficerModal] = useState(false);

  // Department states
  const [departments, setDepartments] = useState([]);
  const [departmentDetails, setDepartmentDetails] = useState({}); // { code: { officers, stats } }
  const [leaderboard, setLeaderboard] = useState([]);
  const [officersPerformance, setOfficersPerformance] = useState([]);
  const [isPerfLoading, setIsPerfLoading] = useState(false);

  const [officerForm, setOfficerForm] = useState({
    name: "", email: "", password: "", phone: "",
    city: "Bhopal", department: "", employeeId: "",
  });

  const [isDeptsLoading, setIsDeptsLoading] = useState(true);

  const [statusForm, setStatusForm] = useState({ status: "", remarks: "" });

  useEffect(() => { fetchAdminData(); }, []);

const fetchAdminData = async () => {
  try {
    const userRes = await API.get("/auth/me");
   const loggedInUser = userRes.data.user || userRes.data.data;

    const allowedRoles = ["admin", "senior_officer"];
    if (!allowedRoles.includes(loggedInUser.role)) {
      toast.error("Only authorized personnel can access this dashboard");
      navigate("/");
      return;
    }

    setAdmin(loggedInUser);

    const complaintRes = await API.get("/admin/complaints");
const allComplaints =
  complaintRes.data.complaints || complaintRes.data.data || [];

    setComplaints(allComplaints);

    if (allComplaints.length > 0) {
      setSelectedComplaint(allComplaints[0]);
    }

    await fetchDepartmentData();
    await fetchPerformanceData();
  } catch (error) {
    console.error("Dashboard data fetch failed:", error);
    if (error.response?.status === 401 || error.response?.status === 403) {
      toast.error("Session expired or unauthorized");
      navigate("/");
    } else {
      toast.error("Failed to load dashboard data. Please refresh.");
    }
  }
};
const fetchDepartmentData = async () => {
  try {
    const [deptRes, lbRes, analyticsRes] = await Promise.all([
      API.get("/departments"),
      API.get("/departments/leaderboard"),
      API.get("/complaints/analytics/summary")
    ]);

    const deptList = deptRes.data.departments || deptRes.data.data || [];
    setDepartments(deptList);

    const leaderboardList = lbRes.data.leaderboard || lbRes.data.data || [];
    setLeaderboard(leaderboardList);

    const analyticsData = analyticsRes.data.departments || [];
    const statsMap = {};
    analyticsData.forEach(d => { statsMap[d._id] = d; });

    const details = {};
    
    // Still need officers per department as there is no bulk endpoint for that yet
    // But we limit parallel requests to avoid throttling
    await Promise.all(
      deptList.map(async (dept) => {
        try {
          const offRes = await API.get(`/departments/${dept.code}/officers`);
          const deptStats = statsMap[dept.code] || { total: 0, resolved: 0 };

          details[dept.code] = {
            officers: offRes.data.officers || offRes.data.data || [],
            stats: deptStats
          };
        } catch (error) {
          details[dept.code] = { officers: [], stats: {} };
        }
      })
    );

    setDepartmentDetails(details);
  } catch (error) {
    console.log("Department fetch failed:", error.response?.data || error.message);
  } finally {
    setIsDeptsLoading(false);
  }
};

const fetchPerformanceData = async () => {
  try {
    setIsPerfLoading(true);
    const res = await API.get("/admin/officers/performance");
    setOfficersPerformance(res.data.officers || []);
  } catch (error) {
    console.error("Failed to fetch performance:", error);
  } finally {
    setIsPerfLoading(false);
  }
};
  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to logout?")) return;
    try {
      await API.post("/auth/logout");
      toast.success("Logged out successfully");
      setTimeout(() => logout(), 1200);
    } catch { 
      // Even if server call fails, clear local state
      logout();
    }
  };

  const handleOfficerChange = (e) =>
    setOfficerForm({ ...officerForm, [e.target.name]: e.target.value });

  const handleCreateOfficer = async (e) => {
    e.preventDefault();
    try {
      // Sync phone with mobileNo as expected by backend
      const payload = { ...officerForm, mobileNo: officerForm.phone };
      await API.post("/admin/create/officer", payload);
      toast.success("Officer created successfully");
      setShowOfficerModal(false);
      setOfficerForm({ name: "", email: "", password: "", phone: "", city: "Bhopal", department: admin?.department || "", employeeId: "" });
    } catch (error) {
      toast.error(error.response?.data?.message || "Officer creation failed");
    }
  };

  const handleStatusUpdate = async (complaintId) => {
    if (!statusForm.status) {
      toast.error("Please select status");
      return;
    }

    try {
      const res = await API.patch(`/complaints/${complaintId}/status`, {
        status: statusForm.status,
        remarks: statusForm.remarks,
      });

      const updated = res.data.updatedComplaint || res.data.data;

      setComplaints((prev) =>
        prev.map((c) => (c._id === complaintId ? updated : c)),
      );

      setSelectedComplaint(updated);
      setStatusForm({ status: "", remarks: "" });

      // refresh department stats after status update
      await fetchDepartmentData();

      toast.success("Complaint status updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Status update failed");
    }
  };
  const stats = useMemo(() => {
    const normalize = (s) => (s || "").toLowerCase();
    return {
      total: complaints.length,
      open: complaints.filter((c) => normalize(c.status) === "open").length,
      underReview: complaints.filter((c) => ["under_review", "review_required", "processing"].includes(normalize(c.status))).length,
      escalated: complaints.filter((c) => normalize(c.status) === "escalated").length,
      resolved: complaints.filter((c) => normalize(c.status) === "resolved").length,
      rejected: complaints.filter((c) => normalize(c.status) === "rejected").length,
      high: complaints.filter((c) => normalize(c.ai?.urgency) === "high" || normalize(c.priority) === "high").length,
    };
  }, [complaints]);

  const filteredComplaints = complaints.filter((item) => {
    const q = search.toLowerCase();
    const matchSearch =
      item.title?.toLowerCase().includes(q) ||
      item.department?.toLowerCase().includes(q) ||
      item.priority?.toLowerCase().includes(q) ||
      item.status?.toLowerCase().includes(q) ||
      item.citizen?.name?.toLowerCase().includes(q) ||
      item.citizen?.email?.toLowerCase().includes(q);
    
    const s = (item.status || "").toLowerCase();
    const f = statusFilter.toLowerCase();
    
    const matchStatus = statusFilter === "All" || s === f;

    return matchSearch && matchStatus;
  });

  /* Officer form fields */
  const officerFields = [
    { name: "name", placeholder: "Full name", type: "text" },
    { name: "email", placeholder: "Email address", type: "email" },
    { name: "password", placeholder: "Password", type: "password" },
    { name: "phone", placeholder: "Phone number (mobileNo)", type: "text" },
    { name: "employeeId", placeholder: "Employee ID", type: "text" },
    { name: "department", placeholder: "Department Code (e.g. ELEC)", type: "text" },
  ];

  return (
    <>
      <FontStyle />
      <div className="sg-app">

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="sg-sidebar">
          <div className="sg-logo">Smart<span>Grieve</span></div>

          <nav className="sg-nav">
            <SidebarBtn icon={LayoutDashboard} label="Dashboard"      tab="dashboard"    active={activeTab === "dashboard"}    onClick={setActiveTab} />
            <SidebarBtn icon={FileText}        label="All Complaints"  tab="complaints"   active={activeTab === "complaints"}   onClick={setActiveTab} />
            <SidebarBtn icon={Users}           label="Officers"        tab="officers"     active={activeTab === "officers"}     onClick={setActiveTab} />
            <SidebarBtn icon={MapPin}          label="Heatmap Access"  tab="heatmap"      active={activeTab === "heatmap"}      onClick={() => {
              setActiveTab("dashboard");
              setTimeout(() => {
                const el = document.getElementById("city-heatmap-section");
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }} />
            <SidebarBtn icon={UserPlus}        label="Add Officer"     tab="officer"      active={activeTab === "officer"}      onClick={setActiveTab} />
            <SidebarBtn icon={User}            label="Profile"         tab="profile"      active={activeTab === "profile"}      onClick={setActiveTab} />

            <button className="sg-logout" onClick={handleLogout}>
              <LogOut size={17} /> Logout
            </button>
          </nav>

          <div className="sg-sidebar-footer">
            <div className="sg-sidebar-user">
              <div className="sg-avatar">{admin?.name?.charAt(0)?.toUpperCase() || "A"}</div>
              <div>
                <div className="sg-sidebar-user-name">{admin?.name || "Admin"}</div>
                <div className="sg-sidebar-user-role">{admin?.role || "admin"}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────────── */}
        <main className="sg-main">

          {/* Topbar */}
          <div className="sg-topbar">
            <div className="sg-topbar-loc">
              <MapPin size={15} />
              {admin?.city || "Bhopal"}
            </div>
            <div className="sg-topbar-right">
              <div className="sg-topbar-avatar">
                {admin?.name?.charAt(0)?.toUpperCase() || "A"}
              </div>
              <div>
                <div className="sg-topbar-name">{admin?.name || "Admin"}</div>
                <div className="sg-topbar-role">{admin?.role || "admin"}</div>
              </div>
            </div>
          </div>

          {/* ── DASHBOARD TAB ──────────────────────────────────────────────── */}
          {activeTab === "dashboard" && (
            <>
              {/* Welcome + Quick action */}
              <div className="sg-flex gap-4 mb-4">
                <div className="sg-welcome" style={{ flex: 1 }}>
                  <h2>Welcome back, {admin?.name || "Admin"} 👋</h2>
                  <p style={{ marginTop: 8 }}>
                    Manage citizen complaints, monitor departments and create officers — all from one place.
                  </p>
                  <div className="sg-welcome-meta">
                    <div className="sg-welcome-chip"><b>City</b> &nbsp;{admin?.city || "—"}</div>
                    <div className="sg-welcome-chip"><b>Role</b> &nbsp;{admin?.role || "Admin"}</div>
                    <div className="sg-welcome-chip"><b>Total</b> &nbsp;{stats.total} complaints</div>
                  </div>
                </div>

                <div className="sg-quick-card">
                  <div>
                    <h3>Create a New Officer</h3>
                    <p>Assign department & credentials instantly.</p>
                  </div>
                  <button className="sg-quick-btn" onClick={() => setShowOfficerModal(true)}>
                    <Plus size={16} /> Add Officer
                  </button>
                </div>
              </div>

              {/* Stat cards */}
              <div className="sg-grid-4 mb-4">
                <StatCard title="Total Complaints" value={stats.total}       icon={FileText}     iconColor="#1a2332" iconBg="#f0f4f8" />
                <StatCard title="Open"             value={stats.open}        icon={Clock}        iconColor="#c87d00" iconBg="#fff7e6" />
                <StatCard title="Under Review"     value={stats.underReview} icon={Activity}     iconColor="#0a84c7" iconBg="#e8f4fd" />
                <StatCard title="Escalated"        value={stats.escalated}   icon={AlertCircle}  iconColor="#f25c5c" iconBg="#fdecea" />
              </div>

              {/* Recent + Detail */}
              <div className="sg-flex gap-4">
                <div className="sg-card" style={{ flex: 1 }}>
                  <div className="sg-flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                    <div className="sg-card-title" style={{ marginBottom: 0 }}>Recent Complaints</div>
                    <button className="sg-btn-outline sg-flex" style={{ alignItems: "center", gap: 6 }}
                      onClick={() => setActiveTab("complaints")}>
                      View all <ChevronRight size={14} />
                    </button>
                  </div>

                  {complaints.length > 0 ? complaints.slice(0, 5).map((item) => (
                    <div key={item._id} className="sg-complaint-row" onClick={() => setSelectedComplaint(item)}>
                      <div>
                        <div className="sg-complaint-title">{item.title}</div>
                        <div className="sg-complaint-meta">
                          {item.citizen?.name || "Citizen"} &nbsp;·&nbsp; {item.department || "Pending Analysis"}
                        </div>
                      </div>
                      <span className={statusBadgeClass(item.status)}>{item.status}</span>
                    </div>
                  )) : (
                    <p style={{ color: "var(--card-muted)", fontSize: 13 }}>No complaints found.</p>
                  )}
                </div>

                {/* Detail panel */}
                <div className="sg-card" style={{ width: 280, flexShrink: 0 }}>
                  <div className="sg-card-title">Complaint Detail</div>
                  {selectedComplaint ? (
                    <>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--card-text)", marginBottom: 8 }}>
                        {selectedComplaint.title || "Grievance Details"}
                      </div>
                      <p style={{ fontSize: 12, color: "var(--card-muted)", lineHeight: 1.6, marginBottom: 12 }}>
                        {selectedComplaint.text || "No detailed description available."}
                      </p>
                      {[
                        ["Citizen",    selectedComplaint.citizen?.name],
                        ["Status",     selectedComplaint.status],
                        ["Priority",   selectedComplaint.priority],
                        ["Department", selectedComplaint.department],
                        ["Location",   selectedComplaint.location?.ward ? `${selectedComplaint.location.ward}, ${selectedComplaint.location.district}` : selectedComplaint.location?.district],
                      ].map(([label, val]) => (
                        <div key={label} className="sg-detail-row">
                          <span className="sg-detail-label">{label}</span>
                          <span className="sg-detail-value">{val || "—"}</span>
                        </div>
                      ))}
                      {/* Media Evidence */}
                      {selectedComplaint.media?.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                          <div className="sg-detail-label" style={{ marginBottom: 8 }}>Evidence Files</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                            {selectedComplaint.media.map((m, idx) => (
                              <a 
                                key={idx} 
                                href={m.video_url || m.image_url} 
                                target="_blank" 
                                rel="noreferrer"
                                style={{ 
                                  position: "relative",
                                  height: 80, 
                                  borderRadius: 8, 
                                  overflow: "hidden", 
                                  background: "#f0f4f8",
                                  border: "1px solid var(--card-border)",
                                  display: "block"
                                }}
                              >
                                {m.video_url || m.type === 'video' ? (
                                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
                                    <video src={m.video_url} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} />
                                    <div style={{ position: "absolute", color: "var(--amber)" }}>
                                      <Play size={18} fill="currentColor" />
                                    </div>
                                  </div>
                                ) : (
                                  <img src={m.image_url} alt="Proof" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                )}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p style={{ color: "var(--card-muted)", fontSize: 13 }}>Select a complaint to view details.</p>
                  )}
                </div>
              </div>

              {/* Heatmap Row */}
              <div className="sg-card" id="city-heatmap-section" style={{ marginTop: 24 }}>
                <div className="sg-card-title">City-wide Grievance Density</div>
                <div className="sg-section-sub">Live heatmap visualizing hotspots and resolution pressure.</div>
                <Heatmap height="500px" />
              </div>
            </>
          )}

          {/* ── ALL COMPLAINTS TAB ─────────────────────────────────────────── */}
          {activeTab === "complaints" && (
            <div className="sg-card">
              <div className="sg-flex mb-6" style={{ justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div className="sg-section-title">All Complaints</div>
                  <div className="sg-section-sub" style={{ marginBottom: 0 }}>
                    View and update every citizen complaint in real time.
                  </div>
                </div>
                <div className="sg-flex gap-3" style={{ flexWrap: "wrap" }}>
                  <div className="sg-search-wrap">
                    <Search size={15} />
                    <input
                      className="sg-input"
                      style={{ width: 260 }}
                      type="text"
                      placeholder="Search complaints…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <select
                    className="sg-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="All">All Status</option>
                    <option value="open">Open</option>
                    <option value="under_review">Under Review</option>
                    <option value="review_required">Review Required</option>
                    <option value="escalated">Escalated</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="sg-table-wrap" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table className="sg-table" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 0 var(--card-border)' }}>
                    <tr>
                      {["ID","Title","Citizen","Officer","Department","Priority","Status","Location","Update"].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComplaints.length > 0 ? filteredComplaints.map((item) => (
                      <tr key={item._id}>
                        <td style={{ fontWeight: 700, fontFamily: "'DM Serif Display', serif", fontSize: 13 }}>
                          {item._id?.slice(-6).toUpperCase()}
                        </td>
                        <td style={{ minWidth: 160, fontWeight: 500 }}>
                          {item.title || (item.text ? item.text.substring(0, 35) + "..." : "Untitled Grievance")}
                        </td>
                        <td style={{ minWidth: 150 }}>
                          <div style={{ fontWeight: 500 }}>{item.citizen?.name || "—"}</div>
                          <div style={{ fontSize: 11, color: "var(--card-muted)" }}>{item.citizen?.email || ""}</div>
                        </td>
                        <td style={{ minWidth: 140 }}>
                          {item.assignedTo ? (
                            <div className="sg-flex" style={{ alignItems: "center", gap: 6 }}>
                              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--navy)", color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                                {item.assignedTo.name?.charAt(0)}
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{item.assignedTo.name}</div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--card-muted)", fontStyle: "italic" }}>Auto-allocating...</span>
                          )}
                        </td>
                        <td style={{ minWidth: 150 }}>{item.department || "Pending Analysis"}</td>
                        <td>{item.priority || "Medium"}</td>
                        <td><span className={statusBadgeClass(item.status)}>{item.status || "Pending"}</span></td>
                        <td style={{ minWidth: 130 }}>{item.location?.ward ? `${item.location.ward}, ${item.location.district}` : (item.location?.district || "—")}</td>
                        <td style={{ minWidth: 260 }}>
                          <div className="sg-flex gap-3">
                            <select
                              className="sg-select"
                              style={{ fontSize: 13 }}
                              value={selectedComplaint?._id === item._id ? statusForm.status : ""}
                              onChange={(e) => {
                                setSelectedComplaint(item);
                                setStatusForm({ ...statusForm, status: e.target.value });
                              }}
                            >
                              <option value="">Status</option>
                              <option value="open">Open</option>
                              <option value="under_review">Under Review</option>
                              <option value="review_required">Review Required</option>
                              <option value="escalated">Escalated</option>
                              <option value="resolved">Resolved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                            <button className="sg-btn-primary" onClick={() => handleStatusUpdate(item._id)}>
                              Save
                            </button>
                          </div>
                          {selectedComplaint?._id === item._id && (
                            <input
                              className="sg-input"
                              style={{ marginTop: 8 }}
                              type="text"
                              placeholder="Remarks (optional)"
                              value={statusForm.remarks}
                              onChange={(e) => setStatusForm({ ...statusForm, remarks: e.target.value })}
                            />
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="8" style={{ textAlign: "center", color: "var(--card-muted)", padding: 40 }}>
                          No complaints found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── OFFICERS PERFORMANCE TAB ───────────────────────────────────────────── */}
          {activeTab === "officers" && (
            <>
              <div className="sg-flex mb-6" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div className="sg-section-title">Officers Performance</div>
                  <div className="sg-section-sub" style={{ marginBottom: 0 }}>
                    {admin?.department 
                      ? `Evaluating performance of officers in the ${admin.department} department.`
                      : "Department overview and officer performance tracking."
                    }
                  </div>
                </div>
                <div className="sg-flex gap-3">
                  <div style={{ background: "#fff7e6", border: "1px solid #fde8b0", borderRadius: 10, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <Users size={15} color="#c87d00" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#c87d00" }}>
                      {(admin?.department ? (departmentDetails[admin.department.toUpperCase()]?.officers?.length || 0) : departments.length)} {admin?.department ? "Officers" : "Departments"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance Cards / Department Grid */}
              <div className="sg-grid-3 mb-6">
                {isPerfLoading ? (
                  <p style={{ color: "var(--card-muted)", fontSize: 13, gridColumn: "1/-1" }}>Loading performance data...</p>
                ) : officersPerformance.length > 0 ? (
                  officersPerformance.map((off) => (
                    <div key={off._id} className="sg-dept-card">
                      <div className="sg-flex gap-3 mb-4">
                        <div className="sg-officer-avatar" style={{ width: 44, height: 44, fontSize: 18, background: 'var(--navy)', color: 'var(--amber)' }}>
                          {off.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="sg-dept-name">{off.name}</div>
                          <div className="sg-flex" style={{ justifyContent: "space-between", alignItems: "center" }}>
                            <div className="sg-officer-dept">ID: {off.employeeId || "—"}</div>
                            <div className="sg-flex" style={{ alignItems: "center", gap: 3 }}>
                              <Star size={11} fill="#f59e0b" color="#f59e0b" />
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--card-text)" }}>{off.averageRating}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="sg-dept-stats">
                        {[
                          { val: off.totalAssigned, lbl: "Assigned" },
                          { val: off.totalResolved, lbl: "Resolved" },
                          { val: off.totalAssigned - off.totalResolved, lbl: "Pending" },
                          { val: off.totalRatings, lbl: "Ratings" },
                        ].map(({ val, lbl }) => (
                          <div key={lbl} className="sg-dept-stat">
                            <div className="sg-dept-stat-val">{val}</div>
                            <div className="sg-dept-stat-lbl">{lbl}</div>
                          </div>
                        ))}
                      </div>

                      <div className="sg-lb-bar-wrap" style={{ marginTop: 12 }}>
                        <div className="sg-lb-bar-bg">
                          <div className="sg-lb-bar-fill" style={{ 
                            width: `${off.resolutionRate}%`,
                            backgroundColor: parseFloat(off.resolutionRate) > 80 ? '#3ecf8e' : parseFloat(off.resolutionRate) > 50 ? '#f5a623' : '#f25c5c'
                          }}></div>
                        </div>
                        <div className="sg-flex" style={{ justifyContent: "space-between", marginTop: 4 }}>
                          <span style={{ fontSize: 10, color: "var(--card-muted)", fontWeight: 600 }}>RESOLUTION RATE</span>
                          <span style={{ fontSize: 10, color: "var(--amber)", fontWeight: 700 }}>
                            {off.resolutionRate}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  // Fallback for Super Admin if no officer data yet: List Departments
                  departments.map((dept) => {
                    const detail = departmentDetails[dept.code] || { officers: [], stats: {} };
                    const s = detail.stats;
                    return (
                      <div key={dept.code} className="sg-dept-card">
                        <div className="sg-dept-name">{dept.name}</div>
                        <span className="sg-dept-code">Code: {dept.code}</span>
                        <div className="sg-dept-stats">
                          {[
                            { val: s.total ?? "—",      lbl: "Total" },
                            { val: s.pending ?? "—",    lbl: "Pending" },
                            { val: s.inProgress ?? "—", lbl: "In Progress" },
                            { val: s.resolved ?? "—",   lbl: "Resolved" },
                          ].map(({ val, lbl }) => (
                            <div key={lbl} className="sg-dept-stat">
                              <div className="sg-dept-stat-val">{val}</div>
                              <div className="sg-dept-stat-lbl">{lbl}</div>
                            </div>
                          ))}
                        </div>
                        <div className="sg-dept-officers-title">
                          <Users size={11} style={{ display: "inline", marginRight: 4 }} />
                          Officers ({detail.officers.length})
                        </div>
                        {detail.officers.length > 0 ? (
                          detail.officers.slice(0, 3).map((officer) => (
                            <div key={officer._id} className="sg-officer-pill">
                              <div className="sg-officer-avatar">{officer.name?.charAt(0)?.toUpperCase()}</div>
                              <div className="sg-officer-name">{officer.name}</div>
                            </div>
                          ))
                        ) : <p style={{ fontSize: 11, color: "var(--card-muted)" }}>No officers.</p>}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Leaderboard - Hide for Senior Officers */}
              {admin?.role !== "senior_officer" && (
                <div className="sg-card">
                <div className="sg-flex" style={{ alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <Trophy size={18} color="#f5a623" />
                  <div className="sg-card-title" style={{ marginBottom: 0 }}>Performance Leaderboard</div>
                </div>

                {leaderboard.length > 0 ? (() => {
                  const maxResolved = Math.max(...leaderboard.map(d => d.resolved ?? 0), 1);
                  return leaderboard.map((dept, i) => (
                    <div key={dept.code || i} className="sg-leaderboard-row">
                      <div className={`sg-rank ${i === 0 ? "sg-rank-1" : i === 1 ? "sg-rank-2" : i === 2 ? "sg-rank-3" : ""}`}>
                        {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                      </div>
                      <div className="sg-lb-bar-wrap">
                        <div className="sg-lb-dept-name">{dept.name}</div>
                        <div className="sg-lb-bar-bg">
                          <div
                            className="sg-lb-bar-fill"
                            style={{ width: `${((dept.resolved ?? 0) / maxResolved) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="sg-lb-resolved">{dept.resolved ?? 0}</div>
                        <div className="sg-lb-resolved-lbl">Resolved</div>
                      </div>
                    </div>
                  ));
                })() : (
                  <p style={{ color: "var(--card-muted)", fontSize: 13 }}>No leaderboard data available.</p>
                )}
              </div>
            )}
          </>
        )}

          {/* ── ADD OFFICER TAB ────────────────────────────────────────────── */}
          {activeTab === "officer" && (
            <div className="sg-card" style={{ maxWidth: 620 }}>
              <div className="sg-section-title">Add Officer</div>
              <div className="sg-section-sub">Create an officer account and assign a department.</div>

              <form onSubmit={handleCreateOfficer}>
                <div className="sg-grid-2 mb-4">
                  {officerFields.map(({ name, placeholder, type }) => (
                    <input
                      key={name}
                      name={name}
                      type={type}
                      placeholder={placeholder}
                      value={officerForm[name]}
                      onChange={handleOfficerChange}
                      className="sg-input"
                      required
                    />
                  ))}
                  <input
                    name="employeeId"
                    placeholder="Employee ID"
                    value={officerForm.employeeId}
                    onChange={handleOfficerChange}
                    className="sg-input"
                    style={{ gridColumn: "1 / -1" }}
                    required
                  />
                </div>
                <button type="submit" className="sg-btn-amber" style={{ width: "100%" }}>
                  Create Officer
                </button>
              </form>
            </div>
          )}

          {/* ── PROFILE TAB ───────────────────────────────────────────────── */}
          {activeTab === "profile" && (
            <div className="sg-card" style={{ maxWidth: 700 }}>
              <div className="sg-flex mb-6" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="sg-section-title">Admin Profile</div>
                  <div className="sg-section-sub" style={{ marginBottom: 0 }}>Logged-in account information.</div>
                </div>
                <button className="sg-btn-amber"
                  onClick={() => toast.info("Edit profile feature coming soon")}>
                  Edit Profile
                </button>
              </div>
              <div className="sg-grid-2">
                {[
                  ["Name", admin?.name],
                  ["Email", admin?.email],
                  ["Phone", admin?.phone],
                  ["City", admin?.city],
                  ["Role", admin?.role],
                  ["Ward Number", admin?.wardNumber],
                ].map(([label, val]) => (
                  <ProfileItem key={label} label={label} value={val} />
                ))}
              </div>
            </div>
          )}
        </main>

        {/* ── Officer Modal ──────────────────────────────────────────────────── */}
        {showOfficerModal && (
          <div className="sg-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowOfficerModal(false); }}>
            <div className="sg-modal">
              <div className="sg-modal-header">
                <div className="sg-modal-title">Create Officer</div>
                <button className="sg-modal-close" onClick={() => setShowOfficerModal(false)}>
                  <XCircle size={18} />
                </button>
              </div>
              <form onSubmit={handleCreateOfficer} className="sg-flex-col gap-3">
                {officerFields.map(({ name, placeholder, type }) => (
                  <input
                    key={name}
                    name={name}
                    type={type}
                    placeholder={placeholder}
                    value={officerForm[name]}
                    onChange={handleOfficerChange}
                    className="sg-input"
                    required
                  />
                ))}
                <input
                  name="employeeId"
                  placeholder="Employee ID"
                  value={officerForm.employeeId}
                  onChange={handleOfficerChange}
                  className="sg-input"
                  required
                />
                <button type="submit" className="sg-btn-amber" style={{ marginTop: 4 }}>
                  Create Officer
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminDashboard;