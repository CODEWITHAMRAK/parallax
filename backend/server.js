import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import schemaRoutes from "./routes/schemaRoutes.js";
import draftRoutes from "./routes/draftRoutes.js";
import voiceRoutes from "./routes/voiceRoutes.js";
import localizationRoutes from "./routes/localizationRoutes.js";
dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(cookieParser());

mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/codefury")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use("/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/schemas", schemaRoutes);
app.use("/api/drafts", draftRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/localization", localizationRoutes);
app.get("/", (req, res) => {
    res.send("Hello World!");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


