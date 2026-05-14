const express = require('express')
const authRoutes = require('../routes/auth.route.js')
const deptRoutes = require('../routes/department.route.js');
const adminRoutes = require('../routes/admin.router.js');
const complaintRoutes = require('../routes/complaint.router.js');
const whatsappRoutes = require('../routes/whatsapp.routes.js');
const cookieParser = require('cookie-parser')

const cors = require('cors');

const app = express();

const allowedOrigins = process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174']
    : ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));

app.use(express.json())
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser())

// Health check for Render
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/departments", deptRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/complaints", complaintRoutes);
app.use('/api/whatsapp', whatsappRoutes);

module.exports = app