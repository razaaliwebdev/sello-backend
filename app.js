import cookieParser from 'cookie-parser';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRouter from './routes/authRoutes.js';
import userRouter from './routes/userRoutes.js';
import carRouter from './routes/carRoutes.js';
import boostRouter from './routes/boostRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import categoryRouter from './routes/categoryRoutes.js';
import blogRouter from './routes/blogRoutes.js';
import notificationRouter from './routes/notificationRoutes.js';
import chatRouter from './routes/chatRoutes.js';
import supportChatRouter from './routes/supportChatRoutes.js';
import analyticsRouter from './routes/analyticsRoutes.js';
import settingsRouter from './routes/settingsRoutes.js';
import promotionsRouter from './routes/promotionsRoutes.js';
import chatbotRouter from './routes/chatbotRoutes.js';
import contactFormRouter from './routes/contactFormRoutes.js';
import carChatRouter from './routes/carChatRoutes.js';
import customerRequestRouter from './routes/customerRequestRoutes.js';
import bannerRouter from './routes/bannerRoutes.js';
import testimonialRouter from './routes/testimonialRoutes.js';
import roleRouter from './routes/roleRoutes.js';

dotenv.config();

export const app = express();

// MIDDLEWARES
app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173", "https://sello.ae"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "email"],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// ROUTES
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/cars", carRouter);
app.use("/api/boost", boostRouter);
app.use("/api/admin", adminRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/blogs", blogRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/chat", chatRouter);
app.use("/api/support-chat", supportChatRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/promotions", promotionsRouter);
app.use("/api/chatbot", chatbotRouter);
app.use("/api/contact-form", contactFormRouter);
app.use("/api/car-chat", carChatRouter);
app.use("/api/customer-requests", customerRequestRouter);
app.use("/api/banners", bannerRouter);
app.use("/api/testimonials", testimonialRouter);
app.use("/api/roles", roleRouter);

// Health check route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SELLO API is running",
    version: "1.0.0"
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

