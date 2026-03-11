import express from "express";

const app = express();
const PORT = 5003;

app.get("/", (req, res) => {
  res.send("Backend Node.js fonctionne");
});

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});