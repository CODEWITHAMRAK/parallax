export const sendSuccess = (res, data = null, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res, message = "Internal Server Error", statusCode = 500, error = null) => {
  const response = {
    success: false,
    message,
  };
  
  if (error && process.env.NODE_ENV === "development") {
    response.error = error.message || error;
  }

  return res.status(statusCode).json(response);
};
