const dotenv = require("dotenv").config();
const app = require("./src/config/app");
const connectDB = require("./src/database/db");
const { initCron } = require("./src/services/cron.service");

const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);

const socketOrigins = process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, "http://localhost:5173", "http://localhost:5174"]
    : ["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"];

const io = new Server(server, {
    cors: {
        origin: socketOrigins,
        credentials: true
    }
});

app.set('io', io);

io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);
    
    socket.on("join_room", (department) => {
        if (department) {
            const roomName = `dept_${department}`;
            socket.join(roomName);
            console.log(`Socket ${socket.id} joined room ${roomName}`);
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

const startServer = async () => {
    try {
        await connectDB();
        initCron();

        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
};

startServer();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});