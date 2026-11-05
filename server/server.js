require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");

const authRoutes = require("./routes/authRoutes");
const caseRoutes = require("./routes/caseRoutes");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const isProduction = process.env.NODE_ENV === "production";

// Configure proxy trust only when the hosting platform's proxy count is known.
const proxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || "", 10);
if (Number.isInteger(proxyHops) && proxyHops > 0) {
  app.set("trust proxy", proxyHops);
}

app.disable("x-powered-by");

// Helmet defaults plus the narrowly scoped sources required by Google Identity Services.
// same-origin-allow-popups lets the Google sign-in popup communicate with this page.
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "https://accounts.google.com/gsi/client"],
        connectSrc: ["'self'", "https://accounts.google.com/gsi/"],
        frameSrc: ["'self'", "https://accounts.google.com/gsi/"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https:",
          "https://accounts.google.com/gsi/style",
        ],
      },
    },
    ...(isProduction ? {} : { strictTransportSecurity: false }),
  })
);

const configuredOrigins =
  process.env.CLIENT_URL ||
  (isProduction ? "" : "http://localhost:5173");

const allowedOrigins = configuredOrigins
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/+$/, "");
      return callback(null, allowedOrigins.includes(normalizedOrigin));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: "20kb" }));

// API health check.
app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  return res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    service: "casefile-api",
    database: databaseConnected ? "connected" : "disconnected",
    message: databaseConnected
      ? "Casefile API and database are running!"
      : "The database is not connected.",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/cases", caseRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "API route not found.",
  });
});

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI in server/.env");
    process.exit(1);
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error("JWT_SECRET is missing or too short.");
    process.exit(1);
  }

  if (isProduction && allowedOrigins.length === 0) {
    console.error(
      "CLIENT_URL must contain at least one allowed frontend origin in production."
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "casefile",
      serverSelectionTimeoutMS: 10000,
    });

    console.log(
      `MongoDB connected successfully: ${mongoose.connection.name}`
    );

    app.listen(PORT, () => {
      console.log(`Casefile API running on port ${PORT}`);
      console.log(`Environment: ${isProduction ? "production" : "development"}`);
      console.log(
        `Allowed frontend origins: ${allowedOrigins.length ? allowedOrigins.join(", ") : "none configured"}`
      );
      console.log(
        `Google sign-in: ${process.env.GOOGLE_CLIENT_ID ? "configured" : "not configured"}`
      );
    });
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
