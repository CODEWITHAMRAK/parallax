export const getLLMAction = async (userInput, context) => {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    throw new Error("MIMO_API_KEY is not defined in environment variables");
  }

  const systemPrompt = `You are a conversational dialogue manager and navigation engine for an accessibility web app.
Your job is to interpret user input, determine the next appropriate step, and output a strict JSON structured action alongside a conversational message.

Supported actions:
- CHAT: For general conversation, greeting, clarifying, or asking for the next field.
- NAVIGATE_STEP: target (step id)
- NEXT: Move to next step
- PREVIOUS: Move to previous step
- FILL_FIELD: field (field id), value
- CLEAR_FIELD: field (field id)
- SELECT_OPTION: field (field id), value
- READ_FIELD: field (field id)
- EXPLAIN_FIELD: field (field id)
- UPLOAD_DOCUMENT: field (field id)
- SUBMIT
- NAVIGATE_PAGE: target (page id, e.g. 'home', 'scholarship_form')

Context provided:
${JSON.stringify(context, null, 2)}

Instructions:
1. Analyze the context (current_step fields vs form_values) and the provided 'chat_history' to understand exactly what the user is responding to.
2. In your "reasoning" block, explicitly perform this verification checklist:
   a. What is the exact raw input provided by the user in the latest message?
   b. What target field does this apply to?
   c. Does the raw input contain 100% complete information for this field without ANY guessing? (e.g., if a date, did they provide the year, month, AND day?)
   d. If the information is incomplete, state that you must use CHAT to ask for the missing info. If complete, state you will use FILL_FIELD.
3. If a required field is missing, ask the user to provide it. DO NOT specify technical formats (like YYYY-MM-DD) in your message. Speak naturally.
4. If the user doesn't understand a field or asks what it is for, use the CHAT action to explain the field in detail using simple terms, then wait for their response.
5. If all fields in a step are filled, summarize what they provided and ask if they are ready to proceed to the next step.
6. When filling a field, explicitly confirm what was recorded in your message before asking for the next missing field.

You MUST return ONLY valid JSON matching this exact schema:
{
  "reasoning": "Step-by-step evaluation of the user's input completeness...",
  "action": "ACTION_NAME",
  "field": "optional_field",
  "value": "optional_value",
  "target": "optional_target",
  "message": "Your conversational reply here"
}
CRITICAL: For fields requiring specific formats (like "YYYY-MM-DD" for dates), you must format the JSON 'value' strictly as requested IF AND ONLY IF your reasoning concludes the information is 100% complete. If it is not, use CHAT instead. Your conversational 'message' MUST NEVER mention technical formats.`;

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
        max_tokens: 1024,
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
