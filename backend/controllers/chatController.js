import { getLLMAction } from "../services/llmService.js";
import User from "../models/User.js";

export const handleChat = async (req, res) => {
  try {
    const { userInput, context } = req.body;
    
    if (!userInput) {
      return res.status(400).json({ message: "User input is required" });
    }

    let userLanguage = context.language || "English";
    if (req.user && req.user.userId) {
      const user = await User.findById(req.user.userId);
      if (user && user.preferredLanguage) {
        userLanguage = user.preferredLanguage;
      }
    }
    
    context.language = userLanguage;

    const action = await getLLMAction(userInput, context);
    res.status(200).json(action);
  } catch (error) {
    console.error("Chat controller error:", error);
    res.status(500).json({ message: "Error processing chat", error: error.message });
  }
};
