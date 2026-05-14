import React, { useEffect, useMemo, useState } from "react";
import {
  Home,
  FileText,
  MapPin,
  LogOut,
} from "lucide-react";
import API from "../utils/api";
import { useNavigate } from "react-router-dom";

const CitizenDashboard = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showComplaintModal, setShowComplaintModal] = useState(false);

  const [complaintForm, setComplaintForm] = useState({
    title: "",
    description: "",
    city: "",
    wardNumber: "",
    location: "",
    imageUrl: "",
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const userRes = await API.get("/api/auth/me");
      setUser(userRes.data.user);

      const complaintRes = await API.get("/api/complaint/my");
      const myComplaints = complaintRes.data.mycomplaint || [];

      setComplaints(myComplaints);

      if (myComplaints.length > 0) {
        setSelectedComplaint(myComplaints[0]);
      }
    } catch (error) {
      console.log(error);
      navigate("/login");
    }
  };

  const handleComplaintChange = (e) => {
    setComplaintForm({
      ...complaintForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogout = async () => {
    try {
      await API.post("/api/auth/logout");
      navigate("/login");
    } catch (error) {
      console.log(error);
      alert("Logout failed");
    }
  };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();

    try {
      await API.post("/api/complaint/create", complaintForm);

      alert("Complaint registered successfully");
      setShowComplaintModal(false);

      setComplaintForm({
        title: "",
        description: "",
        city: "",
        wardNumber: "",
        location: "",
        imageUrl: "",
      });

      fetchDashboardData();
    } catch (error) {
      alert(error.response?.data?.message || "Complaint creation failed");
    }
  };

  const stats = useMemo(() => {
    return {
      total: complaints.length,
      pending: complaints.filter((c) => c.status === "Pending").length,
      inProgress: complaints.filter((c) => c.status === "In Progress").length,
      resolved: complaints.filter((c) => c.status === "Resolved").length,
      rejected: complaints.filter((c) => c.status === "Rejected").length,
    };
  }, [complaints]);

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex">
      {/* Sidebar */}
      <div className="w-[270px] bg-white border-r border-gray-200 min-h-screen p-6">
        <h1 className="text-3xl font-bold text-blue-700 mb-10">
          Smart<span className="text-gray-800">Grieve</span>
        </h1>

        <div className="space-y-3">
          <button className="w-full flex items-center gap-3 bg-blue-100 text-blue-700 font-semibold px-4 py-4 rounded-2xl">
            <Home size={20} /> Dashboard
          </button>

          <button className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-gray-600 hover:bg-gray-100">
            <FileText size={20} /> My Complaints
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-red-600 hover:bg-red-50"
          >
            <LogOut size={20} /> Logout
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 p-6">
        {/* Top Navbar */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <MapPin size={18} /> {user?.city || "City"}
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <h3 className="font-semibold">{user?.name || "User"}</h3>
              <p className="text-sm text-gray-500">{user?.role || "Citizen"}</p>
            </div>
          </div>
        </div>

        {/* Welcome + New Complaint */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="col-span-2 bg-white rounded-3xl p-8 shadow-sm">
            <h2 className="text-3xl font-bold">
              Welcome back, {user?.name || "Citizen"}! 👋
            </h2>

            <div className="flex gap-8 mt-4 text-sm text-gray-600">
              <p>City: {user?.city || "-"}</p>
              <p>Ward: {user?.wardNumber || "-"}</p>
              <p>Role: {user?.role || "citizen"}</p>
            </div>
          </div>

          <div className="bg-blue-600 text-white rounded-3xl p-8 shadow-lg">
            <h3 className="text-2xl font-bold mb-4">Register a New Complaint</h3>

            <button
              onClick={() => setShowComplaintModal(true)}
              className="bg-white text-blue-700 font-semibold px-6 py-3 rounded-xl w-full"
            >
              + Register Complaint
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            ["Total", stats.total],
            ["Pending", stats.pending],
            ["In Progress", stats.inProgress],
            ["Resolved", stats.resolved],
            ["Rejected", stats.rejected],
          ].map(([title, value], index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-5 shadow-sm border"
            >
              <p className="text-sm text-gray-500">{title}</p>
              <h2 className="text-3xl font-bold">{value}</h2>
            </div>
          ))}
        </div>

        {/* Complaints */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 bg-white rounded-3xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold mb-6">My Recent Complaints</h2>

            <div className="space-y-4">
              {complaints.length > 0 ? (
                complaints.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => setSelectedComplaint(item)}
                    className="border-b pb-4 cursor-pointer"
                  >
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-gray-500">
                      {item.status} • {item.priority}
                    </p>
                  </div>
                ))
              ) : (
                <p>No complaints found</p>
              )}
            </div>
          </div>

          <div className="col-span-4 bg-white rounded-3xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-5">Complaint at a Glance</h2>

            {selectedComplaint ? (
              <div>
                <h3 className="font-bold text-lg">{selectedComplaint.title}</h3>
                <p className="text-sm mt-2">{selectedComplaint.description}</p>
              </div>
            ) : (
              <p>No complaints selected</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showComplaintModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-8 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Register New Complaint</h2>
              <button onClick={() => setShowComplaintModal(false)}>×</button>
            </div>

            <form onSubmit={handleComplaintSubmit} className="space-y-4">
              <input
                name="title"
                value={complaintForm.title}
                onChange={handleComplaintChange}
                placeholder="Title"
                className="w-full border rounded-xl p-3"
                required
              />

              <textarea
                name="description"
                value={complaintForm.description}
                onChange={handleComplaintChange}
                placeholder="Description"
                className="w-full border rounded-xl p-3 h-28"
                required
              />

              <input
                name="city"
                value={complaintForm.city}
                onChange={handleComplaintChange}
                placeholder="City"
                className="w-full border rounded-xl p-3"
                required
              />

              <input
                name="wardNumber"
                value={complaintForm.wardNumber}
                onChange={handleComplaintChange}
                placeholder="Ward Number"
                className="w-full border rounded-xl p-3"
                required
              />

              <input
                name="location"
                value={complaintForm.location}
                onChange={handleComplaintChange}
                placeholder="Location"
                className="w-full border rounded-xl p-3"
                required
              />

              <input
                name="imageUrl"
                value={complaintForm.imageUrl}
                onChange={handleComplaintChange}
                placeholder="Image URL"
                className="w-full border rounded-xl p-3"
              />

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
              >
                Submit Complaint
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CitizenDashboard;