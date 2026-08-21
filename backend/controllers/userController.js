import { sendSuccess } from "../utils/response.js";

export const getMe = (req, res) => {
  return sendSuccess(res, { user: req.user }, "You are authenticated");
};

export const updateLanguage = async (req, res) => {
  try {
    const { language } = req.body;
    if (!language) {
      return res.status(400).json({ success: false, message: "Language is required" });
    }
    
    // update user
    req.user.preferredLanguage = language;
    await req.user.save();

    return sendSuccess(res, { user: req.user }, "Language updated successfully");
  } catch (error) {
    console.error("Error updating language:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
