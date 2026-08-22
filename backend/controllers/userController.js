import User from "../models/User.js";
import { sendSuccess } from "../utils/response.js";

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    return sendSuccess(res, { user }, "You are authenticated");
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateLanguage = async (req, res) => {
  try {
    const { language } = req.body;
    if (!language) {
      return res.status(400).json({ success: false, message: "Language is required" });
    }
    
    // update user
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    user.preferredLanguage = language;
    await user.save();

    return sendSuccess(res, { user }, "Language updated successfully");
  } catch (error) {
    console.error("Error updating language:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
