import { sendSuccess, sendError } from "../utils/response.js";
import { verifyGoogleTokenAndGetUser } from "../services/authService.js";

export const loginWithGoogle = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return sendError(res, "No token provided", 400);
    }

    const { token: customJwt, user } = await verifyGoogleTokenAndGetUser(token);

    return sendSuccess(res, { token: customJwt, user }, "Login successful");
  } catch (error) {
    console.error("Authentication error:", error);
    const message = error.message === "Google email is not verified." 
      ? error.message 
      : "Internal authentication error";
    const status = error.message === "Google email is not verified." ? 403 : 500;
    return sendError(res, message, status, error);
  }
};
