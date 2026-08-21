export const getLLMAction = async (userInput, context) => {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    throw new Error("MIMO_API_KEY is not defined in environment variables");
  }

  const systemPrompt = `You are a navigation engine for an accessibility web app.
Your job is to interpret user input and output a strict JSON structured action.

Supported actions:
- NAVIGATE_STEP: target (step id)
- NEXT
- PREVIOUS
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

You MUST return ONLY valid JSON matching this schema:
{ "action": "ACTION_NAME", "field": "optional_field", "value": "optional_value", "target": "optional_target" }
Do not include markdown blocks or any other text.`;

  try {
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
          { role: "user", content: userInput }
        ],
        max_completion_tokens: 256,
        temperature: 0.1, // low temp for predictable JSON
        stream: false
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    
    // Sometimes LLMs return markdown json blocks despite instructions
    if (content.startsWith("\`\`\`json")) {
      content = content.replace(/^\`\`\`json\n|\n\`\`\`$/g, "");
    } else if (content.startsWith("\`\`\`")) {
      content = content.replace(/^\`\`\`\n|\n\`\`\`$/g, "");
    }

    const parsedAction = JSON.parse(content);
    return parsedAction;
  } catch (error) {
    console.error("Error in getLLMAction:", error);
    throw error;
  }
};
