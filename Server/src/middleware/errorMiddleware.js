require("dotenv").config();

const errorMiddleware = (err, req, res, next) => {
  console.error("🔥 ERROR:", err);
  
  res.status(500).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : err.response?.data || "pro"
  });
};

module.exports = errorMiddleware;
