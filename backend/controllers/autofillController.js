import { sendSuccess } from "../utils/response.js";

export const autofillFromDocument = async (req, res) => {
  try {
    const { fileDataUrl, fields } = req.body;
    
    if (!fileDataUrl || !fields || !Array.isArray(fields)) {
      return res.status(400).json({ success: false, message: "Missing fileDataUrl or fields" });
    }

    const apiKey = process.env.MIMO_API_KEY;
    if (!apiKey) {
      throw new Error("MIMO_API_KEY is not defined in environment variables");
    }

    const fieldDescriptions = fields.map(f => `${f.id} (${f.label})`).join(', ');

    const prompt = `You are a document extraction system.
The user uploaded an image of a document (e.g. ID card, Marksheet, Certificate).
Extract the following fields from the document: ${fieldDescriptions}.

You MUST return ONLY valid JSON matching this exact schema:
{
  "success": boolean,
  "extractedData": {
    "field_id": "extracted text or value"
  },
  "reason": "If success is false, briefly explain why (e.g. 'Document unreadable' or 'No relevant fields found.'). If success is true, leave empty or say 'Extracted successfully.'"
}

Instructions:
1. If the document is totally unreadable or irrelevant, set success to false and provide a reason.
2. If some fields are found, set success to true. Only include fields in extractedData that you found with high confidence.
3. For dates, format them as YYYY-MM-DD if possible, otherwise extract as written.
4. If a field is not found, do not include it in extractedData or set it to null.`;

    const response = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mimo-v2.5", // Assuming this model supports vision
        messages: [
          { 
            role: "user", 
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: fileDataUrl } }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
        stream: false,
        thinking: { type: "disabled" }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM Vision API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
      throw new Error("No choices returned from LLM API");
    }

    let content = data.choices[0].message.content.trim();
    console.log("Raw Autofill Vision LLM output:", content);
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Failed to find JSON object in LLM response: ${content}`);
    }

    const parsedResult = JSON.parse(jsonMatch[0]);
    
    return res.status(200).json({
      success: !!parsedResult.success,
      extractedData: parsedResult.extractedData || {},
      reason: parsedResult.reason || ""
    });

  } catch (error) {
    console.error("Document Autofill Error:", error);
    return res.status(500).json({ 
      success: false, 
      extractedData: {},
      reason: "An error occurred during extraction. Please try again or fill manually." 
    });
  }
};
