import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

export const auth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Not Authorized: No Token or Invalid Format"
        });
    }

    const token = authHeader.split(" ")[1]; // "Bearer token"

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select("-password");

        next(); // ✅ don't forget to call next()
    } catch (error) {
        return res.status(401).json({
            error: "Not Authorized: Token Invalid"
        });
    }
};
