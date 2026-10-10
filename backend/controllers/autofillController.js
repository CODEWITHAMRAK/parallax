import { sendSuccess } from "../utils/response.js";

export const autofillFromDocument = async (req, res) => {
  try {
    const { fileDataUrl, fields } = req.body;
    
    if (!fileDataUrl || !fields || !Array.isArray(fields)) {
      return res.status(400).json({ success: false, message: "Missing fileDataUrl or fields" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
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
3. ALL values in 'extractedData' MUST be in English (Latin script/English words). Transliterate or translate any non-English text to English.
4. For dates, format them as YYYY-MM-DD if possible, otherwise extract as written.
5. If a field is not found, do not include it in extractedData or set it to null.`;

    let normalizedDataUrl = fileDataUrl.trim();
    if (normalizedDataUrl.startsWith("data:image/jpg;")) {
      normalizedDataUrl = normalizedDataUrl.replace("data:image/jpg;", "data:image/jpeg;");
    }

    if (normalizedDataUrl.startsWith("data:application/pdf")) {
      return res.status(200).json({
        success: false,
        extractedData: {},
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
        max_tokens: 500,
        temperature: 0.1,
        stream: false
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`LLM Vision API Error: ${response.status} ${errText}`);
      return res.status(200).json({
        success: false,
        extractedData: {},
        reason: "The document image could not be processed. Please capture or upload again clearly."
      });
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
      return res.status(200).json({
        success: false,
        extractedData: {},
        reason: "No response from document recognition."
      });
    }

    let content = data.choices[0].message.content.trim();
    console.log("Raw Autofill Vision LLM output:", content);
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(200).json({
        success: false,
        extractedData: {},
        reason: "Failed to parse document text."
      });
    }

    const parsedResult = JSON.parse(jsonMatch[0]);
    
    return res.status(200).json({
      success: !!parsedResult.success,
      extractedData: parsedResult.extractedData || {},
      reason: parsedResult.reason || ""
    });

  } catch (error) {
    console.error("Document Autofill Error:", error);
    return res.status(200).json({ 
      success: false, 
      extractedData: {},
      reason: "An error occurred during extraction. Please try again or fill manually." 
    });
  }
};
