const errorHandler = (err, _req, res, _next) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      errorCode: err.errorCode,
      ...(err.details || {}),
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ error: `该${field}已被注册` });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join('; ') });
  }

  console.error('Unexpected error:', err);
  return res.status(500).json({ error: '服务器内部错误' });
};

export default errorHandler;
