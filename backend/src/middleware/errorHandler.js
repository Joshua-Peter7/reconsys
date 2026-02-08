function notFound(req, res) {
  res.status(404).json({
    message: 'Route not found',
  });
}

function errorHandler(err, req, res, next) {
  if (err?.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: `File too large. Increase MAX_FILE_SIZE_MB or upload a smaller file.`,
      });
    }

    return res.status(400).json({ message: err.message });
  }

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    message: err.message || 'Unexpected server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
}

module.exports = {
  notFound,
  errorHandler,
};
