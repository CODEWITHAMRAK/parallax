export const getLLMAction = async (userInput, context) => {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    throw new Error("MIMO_API_KEY is not defined in environment variables");
  }

  const userLanguage = context.language || "English";

  const systemPrompt = `You are a conversational dialogue manager and navigation engine for an accessibility web app.
Your job is to interpret user input, determine the next appropriate step, and output a strict JSON structured action alongside a conversational message.
You must ALWAYS respond in the user's selected language: ${userLanguage}. Ensure your conversational 'message' uses this language. Use simple, intuitive words with less jargon.

Supported actions:
- CHAT: For general conversation, greeting, clarifying, or asking for the next field.
- NAVIGATE_STEP: target (step id)
- NEXT: Move to next step
- PREVIOUS: Move to previous step
- FILL_FIELD: Use when successfully extracting form data. Put extracted data into 'filled_fields'.
- CLEAR_FIELD: target (field id to clear, or 'all')
- SELECT_OPTION: Use when extracting a dropdown selection. Put extracted data into 'filled_fields'.
- READ_FIELD: target (field id)
- EXPLAIN_FIELD: target (field id)
- UPLOAD_DOCUMENT: field (field id)
- SUBMIT
- NAVIGATE_PAGE: target (page id, e.g. 'home', 'scholarship_form')
- RESTART_FORM: Clears the entire form and starts over

Context provided:
${JSON.stringify(context, null, 2)}

Instructions:
1. Analyze the context (current_step fields vs form_values) and the provided 'chat_history' to understand exactly what the user is responding to.
2. In your "reasoning" block, strictly perform this verification but keep it extremely brief (under 20 words total): identify input, target field, completeness, and chosen action.
3. Keep your conversational 'message' concise but natural (around 20-30 words, 1-3 sentences). Feel like a friendly human assistant on a phone call, but avoid long monologues.
4. If a required field is missing, ask for it briefly. DO NOT specify technical formats.
5. If the user doesn't understand a field, use CHAT to explain it in one short sentence.
6. When filling a field, briefly confirm what was recorded (e.g., "Got it. Name is John.") before asking for the next field.
7. If the user asks to restart, briefly confirm if they want to delete progress.
36. CRITICAL: NEVER output NEXT or NAVIGATE_STEP if any required fields in the current step are missing. If the user asks to go to the next step but fields are missing, you MUST refuse, output a CHAT action, and ask them to provide the missing required details first.
37. CRITICAL: If the user provides information that fills the LAST missing required field in the current step, you MUST output the NEXT action to advance the UI to the next step. Do NOT output CHAT to ask for fields on the next step while still on the current step! Let the UI advance first.
38. CRITICAL: When extracting an email address from spoken text, meticulously format it. Convert words like "at" to "@" and "dot" to ".", remove all spaces, and output a valid email address (e.g., "john doe at gmail dot com" -> "johndoe@gmail.com").

You MUST return ONLY valid JSON matching this exact schema:
{
  "reasoning": "Brief verification...",
  "action": "ACTION_NAME",
  "filled_fields": {
    "optional_field_id": "extracted_value"
  },
  "target": "optional_target (e.g. for NAVIGATE_STEP, NAVIGATE_PAGE, CLEAR_FIELD)",
  "message": "Extremely brief conversational reply"
}
CRITICAL: For fields requiring specific formats (like "YYYY-MM-DD" for dates), you must format the extracted value strictly as requested. If the user provides multiple pieces of information, extract ALL of them into the "filled_fields" object, even if your main action is CHAT (e.g. when you need to ask for clarification on one missing field). Your conversational 'message' MUST NEVER mention technical formats.`;

  try {
    const chatHistory = context.chat_history || [];
    const formattedHistory = chatHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    const response = await fetch("https://api.xiaomimimo.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mimo-v2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          ...formattedHistory,
          { role: "user", content: userInput }
        ],
        max_tokens: 512,
        temperature: 0.5, // low temp for predictable JSON
        stream: false,
        thinking: {type: "disabled"}
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
      console.error("Unexpected API response:", data);
      throw new Error("No choices returned from LLM API");
    }

    let content = data.choices[0].message.content.trim();
    console.log("Raw LLM output:", content);
    
    if (!content) {
      throw new Error("LLM returned an empty response.");
    }

    // Highly reliable parsing: extract the JSON object
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Failed to find JSON object in LLM response: ${content}`);
    }

    const parsedAction = JSON.parse(jsonMatch[0]);
    return parsedAction;
  } catch (error) {
    console.error("Error in getLLMAction:", error);
    throw error;
  }
};
