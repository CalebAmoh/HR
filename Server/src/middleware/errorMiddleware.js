require("dotenv").config();

const errorMiddleware = (err, req, res, next) => {
  console.error("🔥 ERROR:", err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request payload is too large. Please reduce file sizes and try again.',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

module.exports = errorMiddleware;
