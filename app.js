import cookieParser from 'cookie-parser';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import userRouter from './routes/userRoutes.js';
import carRouter from './routes/carRoutes.js';

dotenv.config();

export const app = express();

// MIDDLEWARES
app.use(cors({
  origin: ["http://localhost:5173", "https://sello.ae"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
// app.get("/", (req, res) => {
//     return res.send("<h1>API Working Fine...</h1>");
// });

app.use("/api/auth", userRouter);
app.use("/api/cars", carRouter);




// Test route
app.get("/", (req, res) => {
  res.send(`<h2>Welcome</h2><a href="/auth/google">Login with Google</a>`);
});

// Protected route
app.get("/profile", (req, res) => {
  if (!req.user) return res.redirect("/");
  res.send(`<h2>Hello, ${req.user.name}</h2><a href="/auth/logout">Logout</a>`);
});

