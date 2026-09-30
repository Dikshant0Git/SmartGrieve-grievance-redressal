import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  FileText,
  Plus,
  LogOut,
  User,
  MapPin,
  ImagePlus,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Map,
  Mic,
  Volume2,
  Trash2,
  RefreshCw,
  Globe,
  Play,
  Star
} from "lucide-react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import API from "./api";
import Heatmap from "./Heatmap";

const FontStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&family=DM+Serif+Display&display=swap');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :root {
      --navy: #0f1623;
      --navy3: #1e2d42;
      --amber: #f5a623;
      --bg: #f0f4f8;
      --white: #ffffff;
      --text: #1a2332;
      --muted: #6b7e96;
      --border: #e8edf2;
    }

    body {
      font-family: 'DM Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
    }

    .cd-page {
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: 'DM Sans', sans-serif;
    }

    .cd-layout {
      display: flex;
      min-height: 100vh;
    }

    .cd-sidebar {
      width: 260px;
      background: var(--navy);
      border-right: 1px solid rgba(255,255,255,0.07);
      padding: 28px 16px;
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      z-index: 20;
    }

    .cd-logo {
      font-family: 'DM Serif Display', serif;
      font-size: 24px;
      font-weight: 400;
      letter-spacing: -0.4px;
      margin-bottom: 36px;
      color: #fff;
      padding: 0 12px;
    }

    .cd-logo span {
      color: var(--amber);
    }

    .cd-nav {
      display: flex;
      flex-direction: column;
      gap: 5px;
      flex: 1;
    }

    .cd-nav-btn {
      border: none;
      background: transparent;
      color: #7a9bbf;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.18s ease;
      text-align: left;
      width: 100%;
    }

    .cd-nav-btn:hover {
      background: var(--navy3);
      color: #f0f4f8;
    }

    .cd-nav-btn.active {
      background: var(--amber);
      color: var(--navy);
      font-weight: 800;
    }

    .cd-nav-btn.active svg {
      color: var(--navy);
    }

    .cd-logout {
      border: none;
      background: transparent;
      color: rgba(242,92,92,0.75);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.18s ease;
      width: 100%;
      margin-top: 8px;
    }

    .cd-logout:hover {
      background: rgba(242,92,92,0.12);
      color: #f25c5c;
    }

    .cd-user-box {
      border-top: 1px solid rgba(255,255,255,0.07);
      padding: 16px 14px 0;
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .cd-avatar {
      width: 38px;
      height: 38px;
      border-radius: 11px;
      background: var(--amber);
      color: var(--navy);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      flex-shrink: 0;
    }

    .cd-user-name {
      font-size: 13px;
      font-weight: 800;
      color: #f0f4f8;
    }

    .cd-user-role {
      font-size: 11px;
      color: #7a9bbf;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.08em;
    }

    .cd-main {
      margin-left: 260px;
      flex: 1;
      padding: 24px 28px;
      min-height: 100vh;
    }

    .cd-topbar {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 22px;
      box-shadow: 0 8px 24px rgba(15,22,35,0.04);
    }

    .cd-title {
      font-family: 'DM Serif Display', serif;
      font-size: 30px;
      font-weight: 400;
      letter-spacing: -0.5px;
      color: var(--text);
      margin-bottom: 4px;
    }

    .cd-subtitle {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.5;
    }

    .cd-location {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 13px;
      color: var(--muted);
      font-weight: 700;
      background: #fff8ea;
      border: 1px solid #ffe4b0;
      padding: 9px 13px;
      border-radius: 12px;
    }

    .cd-location svg {
      color: var(--amber);
    }

    .cd-grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 20px;
    }

    .cd-stat {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      box-shadow: 0 8px 24px rgba(15,22,35,0.035);
    }

    .cd-stat-value {
      font-family: 'DM Serif Display', serif;
      font-size: 36px;
      font-weight: 400;
      color: var(--text);
      line-height: 1;
    }

    .cd-stat-label {
      font-size: 12px;
      color: var(--muted);
      font-weight: 700;
      margin-top: 6px;
    }

    .cd-stat-icon {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: #fff7e6;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #c87d00;
    }

    .cd-card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 26px;
      box-shadow: 0 10px 30px rgba(15,22,35,0.04);
    }

    .cd-card-title {
      font-family: 'DM Serif Display', serif;
      font-size: 24px;
      font-weight: 400;
      color: var(--text);
      margin-bottom: 6px;
    }

    .cd-card-sub {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 22px;
    }

    .cd-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .cd-field {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .cd-field.full {
      grid-column: 1 / -1;
    }

    .cd-label {
      font-size: 11px;
      font-weight: 900;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .cd-input,
    .cd-textarea {
      width: 100%;
      border: 1px solid var(--border);
      background: #fff;
      color: var(--text);
      border-radius: 12px;
      padding: 12px 14px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      outline: none;
      transition: all 0.18s ease;
    }

    .cd-input:focus,
    .cd-textarea:focus {
      border-color: var(--amber);
      box-shadow: 0 0 0 4px rgba(245,166,35,0.12);
    }

    .cd-input:disabled {
      background: #f6f8fb;
      color: var(--muted);
      cursor: not-allowed;
    }

    .cd-textarea {
      min-height: 120px;
      resize: vertical;
    }

    .cd-upload-box {
      border: 1.5px dashed #d4dce6;
      background: #fffdf7;
      border-radius: 16px;
      padding: 24px;
      cursor: pointer;
      transition: all 0.18s ease;
      text-align: center;
    }

    .cd-upload-box:hover {
      border-color: var(--amber);
      background: #fff8ea;
    }

    .cd-upload-icon {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: var(--navy);
      color: var(--amber);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 10px;
    }

    .cd-upload-title {
      font-size: 14px;
      font-weight: 900;
      color: var(--text);
    }

    .cd-upload-sub {
      font-size: 12px;
      color: var(--muted);
      margin-top: 4px;
    }

    .cd-file-input {
      display: none;
    }

    .cd-preview-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-top: 14px;
    }

    .cd-preview {
      position: relative;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--border);
      aspect-ratio: 1 / 1;
      background: #f4f6f9;
    }

    .cd-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .cd-remove-img {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: none;
      background: rgba(15,22,35,0.86);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .cd-submit {
      margin-top: 20px;
      width: 100%;
      border: none;
      background: var(--amber);
      color: var(--navy);
      border-radius: 12px;
      padding: 14px 18px;
      font-size: 15px;
      font-weight: 900;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      transition: all 0.18s ease;
      box-shadow: 0 12px 26px rgba(245,166,35,0.24);
    }

    .cd-submit:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }

    .cd-submit:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      transform: none;
    }

    .cd-btn {
      border: none;
      background: var(--navy);
      color: white;
      border-radius: 12px;
      padding: 12px 18px;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .cd-btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .cd-btn.secondary {
      background: #f1f5f9;
      color: var(--navy);
      border: 1px solid var(--border);
    }

    .cd-btn.secondary:hover {
      background: #e2e8f0;
      border-color: #cbd5e1;
    }

    .cd-complaint-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .cd-complaint {
      border: 1px solid var(--border);
      border-radius: 16px;
      background: #fff;
      padding: 18px;
      transition: all 0.18s ease;
    }

    .cd-complaint:hover {
      border-color: var(--amber);
      background: #fffdf7;
      transform: translateY(-1px);
    }

    .cd-complaint-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 10px;
    }

    .cd-complaint-title {
      font-size: 15px;
      font-weight: 900;
      color: var(--text);
      margin-bottom: 4px;
    }

    .cd-complaint-meta {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }

    .cd-complaint-desc {
      font-size: 13px;
      color: #46566b;
      line-height: 1.6;
      margin: 10px 0 12px;
    }

    .cd-badge {
      padding: 5px 11px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 900;
      white-space: nowrap;
    }

    .badge-pending {
      background: #fff7e6;
      color: #c87d00;
    }

    .badge-assigned {
      background: #e8f0fe;
      color: #1a56db;
    }

    .badge-progress {
      background: #e8f4fd;
      color: #0a84c7;
    }

    .badge-resolved {
      background: #e6faf2;
      color: #1a8f5e;
    }

    .badge-rejected {
      background: #fdecea;
      color: #c0392b;
    }

    .badge-default {
      background: #f0f4f8;
      color: var(--muted);
    }

    .cd-complaint-images {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }

    .cd-complaint-img {
      width: 82px;
      height: 82px;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: #f5f7fa;
      transition: all 0.18s ease;
    }

    .cd-complaint-img:hover {
      transform: scale(1.03);
      border-color: var(--amber);
    }

    .cd-complaint-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .cd-empty {
      padding: 36px;
      text-align: center;
      color: var(--muted);
      font-size: 14px;
      background: #fffdf7;
      border: 1px dashed #f0c979;
      border-radius: 18px;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 1000px) {
      .cd-grid-4 {
        grid-template-columns: repeat(2, 1fr);
      }

      .cd-form-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      .cd-sidebar {
        position: static;
        width: 100%;
        min-height: auto;
      }

      .cd-layout {
        flex-direction: column;
      }

      .cd-main {
        margin-left: 0;
        padding: 16px;
      }

      .cd-topbar {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }

      .cd-grid-4 {
        grid-template-columns: 1fr;
      }

      .cd-preview-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    .cd-voice-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
    }

    .mic-btn {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: none;
      background: var(--amber);
      color: var(--navy);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      margin-bottom: 20px;
      position: relative;
    }

    .mic-btn.recording {
      background: #f25c5c;
      color: white;
      animation: pulse-red 1.5s infinite;
    }

    .mic-btn:hover {
      transform: scale(1.1);
    }

    @keyframes pulse-red {
      0% { box-shadow: 0 0 0 0 rgba(242, 92, 92, 0.7); }
      70% { box-shadow: 0 0 0 15px rgba(242, 92, 92, 0); }
      100% { box-shadow: 0 0 0 0 rgba(242, 92, 92, 0); }
    }

    .voice-timer {
      font-family: 'DM Serif Display', serif;
      font-size: 24px;
      margin-bottom: 10px;
    }

    .voice-controls {
      display: flex;
      gap: 15px;
      margin-top: 25px;
    }

    .voice-btn {
      padding: 10px 20px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: white;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .voice-btn:hover {
      background: #f8fafc;
      border-color: var(--amber);
    }

    .voice-btn.primary {
      background: var(--navy);
      color: white;
      border: none;
    }

    .lang-selector {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
    }

    .lang-btn {
      padding: 8px 16px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: white;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
    }

    .lang-btn.active {
      background: var(--navy);
      color: white;
      border-color: var(--navy);
    }

    /* ── Modal ── */
    .cd-modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 22, 35, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .cd-modal {
      background: white;
      width: 100%;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      animation: modal-up 0.3s ease-out;
    }

    @keyframes modal-up {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .cd-modal-head {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .cd-modal-title {
      font-family: 'DM Serif Display', serif;
      font-size: 18px;
      color: var(--navy);
    }

    .cd-modal-close {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }

    .cd-modal-close:hover {
      color: var(--navy);
    }

    .cd-modal-body {
      padding: 24px;
    }
  `}</style>
);

const statusBadgeClass = (status) => {
  const s = status?.toLowerCase();
  switch (s) {
    case "open":
    case "pending":
      return "cd-badge badge-pending";
    case "under_review":
    case "in progress":
      return "cd-badge badge-progress";
    case "resolved":
      return "cd-badge badge-resolved";
    case "escalated":
    case "rejected":
      return "cd-badge badge-rejected";
    default:
      return "cd-badge badge-default";
  }
};

const NavButton = ({ icon: Icon, label, active, onClick }) => (
  <button className={`cd-nav-btn ${active ? "active" : ""}`} onClick={onClick}>
    <Icon size={17} />
    {label}
  </button>
);

const StatCard = ({ label, value, icon: Icon }) => (
  <div className="cd-stat">
    <div>
      <div className="cd-stat-value">{value}</div>
      <div className="cd-stat-label">{label}</div>
    </div>
    <div className="cd-stat-icon">
      <Icon size={20} />
    </div>
  </div>
);

const CitizenDashboard = () => {
  const navigate = useNavigate();
  const { logout: contextLogout } = useAuth();

  const [activeTab, setActiveTab] = useState("new");
  const [user, setUser] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [complaintLoading, setComplaintLoading] = useState(false);
  const [loadStatus, setLoadStatus] = useState("");

  const [form, setForm] = useState({
    title: "",
    text: "",
    district: "Bhopal",
    ward: "",
    location: "",
    images: [],
  });

  // Voice Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceLang, setVoiceLang] = useState("hi"); // Default to Hindi
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [previews, setPreviews] = useState([]);

  // Rating State
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedComplaintForRating, setSelectedComplaintForRating] = useState(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  const handleRate = async (e) => {
    e.preventDefault();
    if (!ratingStars) return toast.warning("Please select at least 1 star");

    try {
      setSubmittingRating(true);
      const res = await API.post(`/complaints/${selectedComplaintForRating._id}/rate`, {
        stars: ratingStars,
        feedback: ratingFeedback
      });

      toast.success(res.data.message || "Feedback submitted!");
      setShowRatingModal(false);
      setRatingStars(0);
      setRatingFeedback("");
      await fetchMyComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit rating");
    } finally {
      setSubmittingRating(false);
    }
  };

  useEffect(() => {
    fetchCitizenData();
  }, []);

  useEffect(() => {
    if (!user) return;

    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3000");

    socket.on("connect", () => {
      console.log("🟢 Connected to live updates");
      socket.emit("join_room", `user_${user._id || user.id}`);
    });

    socket.on("complaint:status_changed", (updatedData) => {
      toast.info(`Complaint status updated: ${updatedData.status}`);
      setComplaints((prev) =>
        prev.map((c) => (c._id === updatedData._id ? updatedData : c))
      );
    });

    return () => {
      socket.disconnect();
      console.log("🔴 Disconnected from live updates");
    };
  }, [user]);

  const fetchCitizenData = async () => {
    try {
      setLoading(true);

      const userRes = await API.get("/auth/me");
      const loggedInUser = userRes.data.user || userRes.data.data;

      if (!loggedInUser) {
        toast.error("Please login first");
        navigate("/");
        return;
      }

      setUser(loggedInUser);

      setForm((prev) => ({
        ...prev,
        district: loggedInUser.district || "Bhopal",
        ward: loggedInUser.ward || "",
      }));

      await fetchMyComplaints();
    } catch (error) {
      toast.error(error.response?.data?.message || "Please login first");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyComplaints = async () => {
    try {
      const res = await API.get("/complaints/my");

      const list =
        res.data.mycomplaint || res.data.complaints || res.data.data || [];

      setComplaints(Array.isArray(list) ? list : []);
    } catch (error) {
      if (error.response?.status === 404) {
        setComplaints([]);
      } else {
        toast.error(
          error.response?.data?.message || "Failed to fetch complaints",
        );
      }
    }
  };

  const handleLogout = async () => {
    try {
      // 1. Notify backend (optional but good practice)
      await API.post("/auth/logout");
    } catch (error) {
      console.error("Backend logout failed:", error);
    } finally {
      // 2. Clear local auth state and redirect
      toast.success("Logged out successfully");
      contextLogout();
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 🎤 Voice Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const newRecorder = new MediaRecorder(stream);
      const chunks = [];

      newRecorder.ondataavailable = (e) => chunks.push(e.data);
      newRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      setRecorder(newRecorder);
      newRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Timer
      const interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      
      newRecorder.onstart = () => {
        newRecorder._interval = interval;
      };
      
      newRecorder.onstop = (e) => {
        clearInterval(newRecorder._interval);
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

    } catch (err) {
      toast.error("Microphone access denied or not available");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      setIsRecording(false);
      recorder.stream.getTracks().forEach(track => track.stop());
    }
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const submitVoiceComplaint = async () => {
    if (!audioBlob) return;

    try {
      setIsTranscribing(true);
      const formData = new FormData();
      formData.append("audio", audioBlob, "complaint.webm");
      formData.append("language", voiceLang);
      formData.append("district", form.district);
      formData.append("ward", form.ward);

      const res = await API.post("/complaints/voice", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data.success) {
        toast.success("Voice complaint submitted and analyzed!");
        
        // Auto-play AI voice response if provided
        if (res.data.audioResponse) {
          const aiAudio = new Audio(`data:audio/mp3;base64,${res.data.audioResponse}`);
          aiAudio.play().catch(e => console.error("Playback failed:", e));
        }

        resetRecording();
        setActiveTab("my");
        fetchMyComplaints();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Voice submission failed");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleImagesChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (selectedFiles.length === 0) return;

    const totalFiles = [...form.images, ...selectedFiles].slice(0, 5);

    setForm({
      ...form,
      images: totalFiles,
    });

    const previewUrls = totalFiles.map((file) => URL.createObjectURL(file));
    setPreviews(previewUrls);

    e.target.value = "";
  };

  const removeImage = (index) => {
    const updatedImages = form.images.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);

    setForm({
      ...form,
      images: updatedImages,
    });

    setPreviews(updatedPreviews);
  };

  const resetForm = () => {
    setForm({
      title: "",
      text: "",
      district: user?.district || "Bhopal",
      ward: user?.ward || "",
      location: "",
      images: [],
    });

    setPreviews([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.text ||
      !form.district ||
      !form.ward ||
      !form.location
    ) {
      toast.error("Required: Description, City, Ward, and Location");
      return;
    }

    const complaintTitle = form.title.trim() || form.text.substring(0, 30) + "...";

    try {
      setComplaintLoading(true);
      setLoadStatus("Uploading media...");

      const formData = new FormData();

      formData.append("title", complaintTitle);
      formData.append("text", form.text.trim());
      formData.append("district", form.district.trim());
      formData.append("ward", form.ward.trim());
      formData.append("location", form.location.trim());

      form.images.forEach((file) => {
        formData.append("media", file);
      });

      setLoadStatus("AI Analysis in progress...");
      const res = await API.post("/complaints/create", formData);

      toast.success(res.data.message || "Complaint created successfully");

      resetForm();
      await fetchMyComplaints();
      setActiveTab("my");
    } catch (error) {
      toast.error(error.response?.data?.message || "Complaint creation failed");
    } finally {
      setComplaintLoading(false);
      setLoadStatus("");
    }
  };

  const stats = {
    total: complaints.length,
    pending: complaints.filter((item) => ["open", "pending"].includes(item.status?.toLowerCase())).length,
    progress: complaints.filter((item) => ["under_review", "in progress"].includes(item.status?.toLowerCase())).length,
    resolved: complaints.filter((item) => item.status?.toLowerCase() === "resolved").length,
  };

  if (loading) {
    return (
      <>
        <FontStyle />
        <div
          className="cd-page"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loader2 size={28} className="spin" />
          <span style={{ marginLeft: 10, fontWeight: 800 }}>
            Loading dashboard...
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      <FontStyle />

      <div className="cd-page">
        <div className="cd-layout">
          <aside className="cd-sidebar">
            <div className="cd-logo">
              Smart<span>Grieve</span>
            </div>

            <nav className="cd-nav">
              <NavButton
                icon={Plus}
                label="New Complaint"
                active={activeTab === "new"}
                onClick={() => setActiveTab("new")}
              />

              <NavButton
                icon={Mic}
                label="Voice Complaint"
                active={activeTab === "voice"}
                onClick={() => setActiveTab("voice")}
              />

              <NavButton
                icon={FileText}
                label="My Complaints"
                active={activeTab === "my"}
                onClick={() => setActiveTab("my")}
              />

              <NavButton
                icon={Map}
                label="City Heatmap"
                active={activeTab === "heatmap"}
                onClick={() => setActiveTab("heatmap")}
              />

              <NavButton
                icon={User}
                label="Profile"
                active={activeTab === "profile"}
                onClick={() => setActiveTab("profile")}
              />
            </nav>

            <button className="cd-logout" onClick={handleLogout}>
              <LogOut size={17} />
              Logout
            </button>

            <div className="cd-user-box">
              <div className="cd-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || "C"}
              </div>

              <div>
                <div className="cd-user-name">{user?.name || "Citizen"}</div>
                <div className="cd-user-role">{user?.role || "citizen"}</div>
              </div>
            </div>
          </aside>

          <main className="cd-main">
            <div className="cd-topbar">
              <div>
                <div className="cd-title">
                  Welcome, {user?.name || "Citizen"} 👋
                </div>
                <div className="cd-subtitle">
                  Register complaints, upload proof images and track status
                  easily.
                </div>
              </div>

              <div className="cd-location">
                <MapPin size={16} />
                {user?.district || "Bhopal"}
              </div>
            </div>

            <div className="cd-grid-4">
              <StatCard
                label="Total Complaints"
                value={stats.total}
                icon={FileText}
              />
              <StatCard label="Pending" value={stats.pending} icon={Clock} />
              <StatCard
                label="In Progress"
                value={stats.progress}
                icon={AlertCircle}
              />
              <StatCard
                label="Resolved"
                value={stats.resolved}
                icon={CheckCircle}
              />
            </div>

            {activeTab === "new" && (
              <div className="cd-card">
                <div className="cd-card-title">Register New Complaint</div>
                <div className="cd-card-sub">
                  Fill complaint details and upload up to 5 images or videos as proof.
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="cd-form-grid">
                    <div className="cd-field full">
                      <label className="cd-label">Complaint Title</label>
                      <input
                        className="cd-input"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        placeholder="Example: Street light not working"
                      />
                    </div>

                    <div className="cd-field full">
                      <label className="cd-label">Description</label>
                      <textarea
                        className="cd-textarea"
                        name="text"
                        value={form.text}
                        onChange={handleChange}
                        placeholder="Describe your problem clearly..."
                      />
                    </div>

                    <div className="cd-field">
                      <label className="cd-label">City</label>
                      <input
                        className="cd-input"
                        name="district"
                        value={form.district}
                        onChange={handleChange}
                        placeholder="Bhopal"
                      />
                    </div>

                    <div className="cd-field">
                      <label className="cd-label">Ward Number</label>
                      <input
                        className="cd-input"
                        name="ward"
                        value={form.ward}
                        onChange={handleChange}
                        placeholder="21"
                      />
                    </div>

                    <div className="cd-field full">
                      <label className="cd-label">Location / Address</label>
                      <input
                        className="cd-input"
                        name="location"
                        value={form.location}
                        onChange={handleChange}
                        placeholder="MP Nagar Zone 1, Bhopal"
                      />
                    </div>

                    <div className="cd-field full">
                      <label className="cd-label">Upload Evidence (Images/Video)</label>

                      <label className="cd-upload-box">
                        <input
                          className="cd-file-input"
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          onChange={handleImagesChange}
                        />

                        <div className="cd-upload-icon">
                          <ImagePlus size={22} />
                        </div>

                        <div className="cd-upload-title">
                          Click to upload images or videos
                        </div>

                        <div className="cd-upload-sub">
                          JPG, PNG, WEBP, MP4 allowed. Maximum 5 files.
                        </div>
                      </label>

                      {previews.length > 0 && (
                        <div className="cd-preview-grid">
                          {previews.map((src, index) => (
                            <div className="cd-preview" key={index}>
                              {form.images[index]?.type.startsWith('video') ? (
                                <video 
                                  src={src} 
                                  autoPlay 
                                  muted 
                                  loop 
                                  playsInline
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                />
                              ) : (
                                <img src={src} alt={`Preview ${index + 1}`} />
                              )}

                              <button
                                type="button"
                                className="cd-remove-img"
                                onClick={() => removeImage(index)}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    className="cd-submit"
                    type="submit"
                    disabled={complaintLoading}
                  >
                    {complaintLoading ? (
                      <>
                        <Loader2 size={17} className="spin" />
                        {loadStatus || "Submitting..."}
                      </>
                    ) : (
                      <>
                        <Plus size={17} />
                        Submit Complaint
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

        {activeTab === "voice" && (
          <div className="cd-card">
            <div className="cd-card-title">Voice Grievance</div>
            <div className="cd-card-sub">
              Speak naturally in Hindi or English. Our AI will transcribe and categorize your issue.
            </div>

            <div className="cd-voice-card">
              <div className="lang-selector">
                <button 
                  className={`lang-btn ${voiceLang === "hi" ? "active" : ""}`}
                  onClick={() => setVoiceLang("hi")}
                >
                  <Globe size={14} style={{marginRight: '6px'}} /> Hindi
                </button>
                <button 
                  className={`lang-btn ${voiceLang === "en" ? "active" : ""}`}
                  onClick={() => setVoiceLang("en")}
                >
                  <Globe size={14} style={{marginRight: '6px'}} /> English
                </button>
              </div>

              {!audioUrl ? (
                <>
                  <button 
                    className={`mic-btn ${isRecording ? "recording" : ""}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isTranscribing}
                  >
                    <Mic size={32} />
                  </button>
                  <div className="voice-timer">
                    {isRecording ? formatTime(recordingTime) : "Tap to record"}
                  </div>
                  <p className="cd-subtitle" style={{marginTop: '10px'}}>
                    {isRecording ? "Recording in progress..." : "Briefly describe your problem"}
                  </p>
                </>
              ) : (
                <>
                  <div className="cd-stat-icon" style={{width: '60px', height: '60px', marginBottom: '20px', background: 'var(--navy)', color: 'var(--amber)'}}>
                    <Volume2 size={24} />
                  </div>
                  <audio src={audioUrl} controls style={{marginBottom: '20px'}} />
                  
                  <div className="voice-controls">
                    <button className="voice-btn" onClick={resetRecording} disabled={isTranscribing}>
                      <Trash2 size={16} /> Delete
                    </button>
                    <button className="voice-btn" onClick={resetRecording} disabled={isTranscribing}>
                      <RefreshCw size={16} /> Re-record
                    </button>
                    <button 
                      className="voice-btn primary" 
                      onClick={submitVoiceComplaint}
                      disabled={isTranscribing}
                    >
                      {isTranscribing ? (
                        <>
                          <Loader2 size={16} className="spin" /> Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} /> Submit Complaint
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

            {activeTab === "my" && (
              <div className="cd-card">
                <div className="cd-card-title">My Complaints</div>
                <div className="cd-card-sub">
                  Track all complaints submitted by your account.
                </div>

                {complaints.length > 0 ? (
                  <div className="cd-complaint-list">
                    {complaints.map((item) => (
                      <div className="cd-complaint" key={item._id}>
                        <div className="cd-complaint-head">
                          <div>
                            <div className="cd-complaint-title">
                              {item.grievanceId || "Pending ID"}
                            </div>

                            <div className="cd-complaint-meta">
                              {
                                item.assignedDept === 'MUNC' ? 'Municipal Corp' :
                                item.assignedDept === 'ELEC' ? 'Electricity Board' :
                                item.assignedDept === 'HLTH' ? 'Health Dept' :
                                item.assignedDept === 'TRNS' ? 'Transport Dept' :
                                item.assignedDept === 'REVN' ? 'Revenue Dept' :
                                item.assignedDept === 'GENL' ? 'General Admin' :
                                item.assignedDept || "Pending Analysis"
                              } •{" "}
                              {item.ai?.category?.[0] || "Uncategorized"} •{" "}
                              {item.ai?.urgency || "Medium"}
                            </div>
                          </div>

                          <span className={statusBadgeClass(item.status)}>
                            {item.status || "Pending"}
                          </span>
                        </div>

                        <div className="cd-complaint-desc">
                          {item.text}
                        </div>

                        <div className="cd-complaint-meta">
                          <b>Area:</b> {item.location?.address || "—"} • <b>Ward:</b>{" "}
                          {item.location?.ward || "—"} • <b>City:</b>{" "}
                          {item.location?.district || "—"}
                        </div>

                        <div className="cd-complaint-meta" style={{ color: "var(--navy)", fontWeight: 600 }}>
                          <b>Assigned Officer:</b> {item.assignedTo?.name || "Allocating..."}
                        </div>

                        {item.ai?.summary && (
                          <div
                            className="cd-complaint-meta"
                            style={{ marginTop: 6 }}
                          >
                            <b>AI Summary:</b> {item.ai.summary}
                          </div>
                        )}

                        {item.media?.length > 0 && (
                          <div className="cd-complaint-images">
                            {item.media.map((m, index) => (
                              <a
                                href={m.video_url || m.image_url}
                                target="_blank"
                                rel="noreferrer"
                                className="cd-complaint-img"
                                key={index}
                                style={{ display: 'block', position: 'relative' }}
                              >
                                {m.type === 'video' || m.video_url ? (
                                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f5a623' }}>
                                    <video src={m.video_url} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                    <div style={{ position: 'absolute' }}>
                                      <Play size={20} fill="currentColor" />
                                    </div>
                                  </div>
                                ) : (
                                  <img src={m.image_url} alt={`Proof ${index + 1}`} />
                                )}
                              </a>
                            ))}
                          </div>
                        )}

                        {/* RATING SECTION */}
                        {item.status === 'resolved' && (
                          <div className="cd-rating-section" style={{marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #f1f5f9'}}>
                            {item.rating?.stars ? (
                              <div className="cd-rating-display" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <span style={{fontSize: '13px', fontWeight: '600', color: '#64748b'}}>Your Rating:</span>
                                <div style={{display: 'flex', gap: '2px'}}>
                                  {[...Array(5)].map((_, i) => (
                                    <Star 
                                      key={i} 
                                      size={14} 
                                      fill={i < item.rating.stars ? "#f59e0b" : "transparent"} 
                                      color={i < item.rating.stars ? "#f59e0b" : "#cbd5e1"} 
                                    />
                                  ))}
                                </div>
                                {item.rating.feedback && <span style={{fontSize: '12px', fontStyle: 'italic', color: '#94a3b8', marginLeft: '8px'}}>"{item.rating.feedback}"</span>}
                              </div>
                            ) : (
                              <button 
                                className="cd-btn secondary" 
                                style={{padding: '6px 12px', fontSize: '12px'}}
                                onClick={() => {
                                  setSelectedComplaintForRating(item);
                                  setShowRatingModal(true);
                                }}
                              >
                                <Star size={14} /> Rate Resolution
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="cd-empty">
                    No complaints found. Create your first complaint now.
                  </div>
                )}
              </div>
            )}

            {activeTab === "heatmap" && (
              <div className="cd-card">
                <div className="cd-card-title">Bhopal Grievance Heatmap</div>
                <div className="cd-card-sub">
                  Live visualization of grievance density across Bhopal wards.
                </div>
                <Heatmap height="550px" />
              </div>
            )}

            {activeTab === "profile" && (
              <div className="cd-card">
                <div className="cd-card-title">Citizen Profile</div>
                <div className="cd-card-sub">
                  Your registered account information.
                </div>

                <div className="cd-form-grid">
                  <div className="cd-field">
                    <label className="cd-label">Name</label>
                    <input
                      className="cd-input"
                      value={user?.name || ""}
                      disabled
                    />
                  </div>

                  <div className="cd-field">
                    <label className="cd-label">Email</label>
                    <input
                      className="cd-input"
                      value={user?.email || ""}
                      disabled
                    />
                  </div>

                  <div className="cd-field">
                    <label className="cd-label">Phone Number</label>
                    <input
                      className="cd-input"
                      value={user?.mobileNo || ""}
                      disabled
                    />
                  </div>

                  <div className="cd-field">
                    <label className="cd-label">City</label>
                    <input
                      className="cd-input"
                      value={user?.district || "Bhopal"}
                      disabled
                    />
                  </div>

                  <div className="cd-field">
                    <label className="cd-label">Ward Number</label>
                    <input
                      className="cd-input"
                      value={user?.ward || ""}
                      disabled
                    />
                  </div>

                  <div className="cd-field">
                    <label className="cd-label">Role</label>
                    <input
                      className="cd-input"
                      value={user?.role || ""}
                      disabled
                    />
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* RATING MODAL */}
        {showRatingModal && (
          <div className="cd-modal-overlay" onClick={() => setShowRatingModal(false)}>
            <div className="cd-modal" style={{maxWidth: '400px'}} onClick={(e) => e.stopPropagation()}>
              <div className="cd-modal-head">
                <div className="cd-modal-title">Rate Resolution</div>
                <button className="cd-modal-close" onClick={() => setShowRatingModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="cd-modal-body" style={{textAlign: 'center'}}>
                <p style={{marginBottom: '20px', color: '#64748b', fontSize: '14px'}}>
                  How would you rate the resolution of complaint <b>{selectedComplaintForRating?.grievanceId}</b>?
                </p>
                
                <div style={{display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '25px'}}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingStars(star)}
                      style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0}}
                    >
                      <Star 
                        size={32} 
                        fill={star <= ratingStars ? "#f59e0b" : "transparent"} 
                        color={star <= ratingStars ? "#f59e0b" : "#cbd5e1"} 
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>

                <div className="cd-field">
                  <label className="cd-label" style={{textAlign: 'left'}}>Additional Feedback (Optional)</label>
                  <textarea 
                    className="cd-input" 
                    placeholder="Tell us about your experience..."
                    rows={3}
                    value={ratingFeedback}
                    onChange={(e) => setRatingFeedback(e.target.value)}
                  />
                </div>

                <button 
                  className="cd-btn" 
                  style={{width: '100%', marginTop: '20px'}}
                  onClick={handleRate}
                  disabled={submittingRating || !ratingStars}
                >
                  {submittingRating ? <Loader2 size={18} className="spin" /> : "Submit Feedback"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CitizenDashboard;