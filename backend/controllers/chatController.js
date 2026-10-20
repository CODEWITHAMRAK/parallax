import { getGeminiLLMAction, getGeminiLLMActionStream } from "../services/llmService.js";
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

    const action = await getGeminiLLMAction(userInput, context);
    res.status(200).json(action);
  } catch (error) {
    console.error("Chat controller error:", error);
    res.status(500).json({ message: "Error processing chat", error: error.message });
  }
};

export const handleChatStream = async (req, res) => {
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

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering on Nginx/Render
    res.flushHeaders();

    const onSentence = (sentence) => {
      res.write(`data: ${JSON.stringify({ type: 'sentence', text: sentence })}\n\n`);
    };

    // Wait for the full LLM response to complete
    const action = await getGeminiLLMAction(userInput, context);
    
    // Send the full text as a single "sentence" so the frontend sends the full text to TTS
    if (action.message) {
      onSentence(action.message);
    }
    
    // Send final action
    res.write(`data: ${JSON.stringify({ type: 'action', data: action })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Chat stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error streaming chat", error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
};
