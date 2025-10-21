import express from "express";
import dotenv from "dotenv";
import { signup } from "./routes/signup.js";
import { login } from "./routes/login.js";
import { refresh } from "./routes/refresh.js";
import { logout } from "./routes/logout.js";
import { signupInit } from "./routes/signup/init.js";
import { signupVerify } from "./routes/signup/verify.js";
import { signupComplete } from "./routes/signup/complete.js";

dotenv.config();

const app = express();
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.post("/api/signup", signup);
app.post("/api/login", login);
app.post("/api/refresh", refresh);
app.post("/api/logout", logout);

// Routes Brique 4 (nouvelles - onboarding)
app.post("/api/id/signup/init", signupInit);
app.post("/api/id/signup/verify", signupVerify);
app.post("/api/id/signup/complete", signupComplete);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur MOLAM ID démarré sur le port ${PORT}`);
});