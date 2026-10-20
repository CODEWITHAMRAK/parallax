import { sendSuccess } from "../utils/response.js";

export const verifyDocument = async (req, res) => {
  try {
    const { fileDataUrl, expectedType } = req.body;
    
    if (!fileDataUrl || !expectedType) {
      return res.status(400).json({ success: false, message: "Missing fileDataUrl or expectedType" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }

    const prompt = `You are a strict document verification system.
The user is trying to upload a document of type: ${expectedType}.
Analyze the provided image and verify if it matches this expected document type.
If the document is extremely blurry or entirely unreadable, return documentMatch as false.
If the document is readable and matches the expected type, return documentMatch as true.

You MUST return ONLY valid JSON matching this exact schema:
{
  "documentMatch": boolean,
  "reason": "A brief 1-sentence explanation of your decision. If it fails, explain why (e.g. 'This appears to be a marksheet, not an income certificate.'). If it succeeds, just say 'Document looks good.'"
}`;

    let normalizedDataUrl = fileDataUrl.trim();
    if (normalizedDataUrl.startsWith("data:image/jpg;")) {
      normalizedDataUrl = normalizedDataUrl.replace("data:image/jpg;", "data:image/jpeg;");
    }

    if (normalizedDataUrl.startsWith("data:application/pdf")) {
      return res.status(200).json({
        documentMatch: false,
        readable: false,
        reason: "PDF could not be parsed as an image. Please try again."
      });
    }

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash-lite",
        messages: [
          { 
            role: "user", 
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: normalizedDataUrl } }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.1,
        stream: false
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`LLM Vision API Error: ${response.status} ${errText}`);
      return res.status(200).json({
        documentMatch: false,
        readable: false,
        reason: "The document image could not be processed. Please capture or upload again clearly."
      });
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
      return res.status(200).json({
        documentMatch: false,
        readable: false,
        reason: "No response from document verification."
      });
    }

    let content = data.choices[0].message.content.trim();
    console.log("Raw Vision LLM output:", content);
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({
        documentMatch: false,
        readable: false,
        reason: "Failed to verify document image."
      });
    }

    const parsedResult = JSON.parse(jsonMatch[0]);
    
    // We must return what the frontend expects
    const finalResult = {
      documentMatch: !!parsedResult.documentMatch,
      readable: true, // We assume if it's a match, it's readable
      reason: parsedResult.reason || "Verified."
    };

    return res.status(200).json(finalResult);

  } catch (error) {
    console.error("Document Verification Error:", error);
    return res.status(200).json({ 
      documentMatch: false, 
      readable: false, 
      reason: "An error occurred during verification. Please try again." 
    });
  }
};
