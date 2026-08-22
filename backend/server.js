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
import submissionRoutes from "./routes/submissionRoutes.js";
import informationRoutes from "./routes/informationRoutes.js";
import voiceRoutes from "./routes/voiceRoutes.js";
import localizationRoutes from "./routes/localizationRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
dotenv.config();

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(cookieParser());

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/static", express.static(path.join(__dirname, "public")));

mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/codefury")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use("/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/schemas", schemaRoutes);
app.use("/api/drafts", draftRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/information", informationRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/localization", localizationRoutes);
app.use("/api/upload", uploadRoutes);
app.get("/", (req, res) => {
    res.send("Hello World!");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


