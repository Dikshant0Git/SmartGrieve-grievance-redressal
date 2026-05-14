const roleMiddleware = (...allowedRoles) => {
    return (req, res, next) => {
        // authMiddleware must run before this
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        console.log("req.user:", req.user);
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Allowed roles: ${allowedRoles.join(", ")}`
            });
        }

        next();
    };
};

module.exports = roleMiddleware;