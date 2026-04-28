import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api", (req, res) => {
  res.json({ message: "Server is working 🚀" });
});

app.get("/api/products", (req, res) => {
  res.json([
    { id: 1, name: "Phone", price: 200 },
    { id: 2, name: "Laptop", price: 800 }
  ]);
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});