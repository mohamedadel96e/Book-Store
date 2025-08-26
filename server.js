const express = require("express");

const colors = require("colors");
const dotenv = require("dotenv").config();
const cors = require("cors");
const {errorHandler} = require("./middlewares/errorMiddleware");
const connectDB = require("./config/db");
const path = require("path");
const port = process.env.PORT || 5000;

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: false}));

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Knowledge Vault API",
    version: "1.0.0",
    endpoints: {
      users: "/api/users",
      books: "/api/books",
      categories: "/api/categories",
      library: "/api/library",
      plans: "/api/plans",
      analytics: "/api/analytics (Watcher only)",
      health: "/api/health",
    },
  });
});

// --- API Routes ---
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/books", require("./routes/bookRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/library", require("./routes/libraryRoutes"));
app.use("/api/plans", require("./routes/planRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/storage", express.static(path.join(__dirname, "storage")));

// Custom Error Handler
app.use(errorHandler);

app.listen(port, () =>
  console.log(`Server started on port ${port}`.cyan.underline)
);
