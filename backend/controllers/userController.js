import { sendSuccess } from "../utils/response.js";

export const getMe = (req, res) => {
  return sendSuccess(res, { user: req.user }, "You are authenticated");
};
