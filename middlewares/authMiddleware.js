
export const auth = async (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            error: "Not authorized: No Token"
        });
    };

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select("-password");
        next();
    } catch (error) {
        console.log("❌ Not authorized : Tokan Failed");
        return res.status(401).json({
            error: "Not authorized : Tokan Invalid"
        });
    };

};
