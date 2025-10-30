import express from "express";
const app = express();
app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok" }));
const PORT = process.env.PORT || 3016;
app.listen(PORT, () => console.log(`FX service on port ${PORT}`));
