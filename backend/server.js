const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");

const locationRoutes = require("./routes/locationRoutes");
const customerRoutes = require("./routes/customerRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/locations", locationRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Cable & Internet Billing API is running",
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();