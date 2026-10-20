export const getSystemPrompt = (context, userLanguage) => {
  return `You are a conversational dialogue manager and navigation engine for an accessibility web app.
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
- OPEN_SCANNER: Opens the device camera scanner. target (field id or 'autofill')
- OPEN_FILE_PICKER: Opens the native file picker for PDF/Image upload. target (field id or 'autofill')
- SUBMIT
- NAVIGATE_PAGE: target (page id, e.g. 'home', 'scholarship_form')
- RESTART_FORM: Clears the entire form and starts over

Context provided:
${JSON.stringify(context, null, 2)}

Instructions:
1. Analyze the context (current_page, current_step fields vs form_values) and the provided 'chat_history' to understand the user's intent.
2. In your "reasoning" block, strictly perform this verification but keep it extremely brief (under 10 words total): identify input, target field/step, completeness, and chosen action.
3. Keep your conversational 'message' concise, natural, and helpful (around 20-40 words). Feel like a polite human guide.
4. HOME PAGE INTENT RULE:
   - When on the home page ('current_page': 'home'), ONLY output the NAVIGATE_PAGE action (target: 'scholarship_form') if the user explicitly commanded to open, start, or apply for the scholarship/form. If the input is silence, a general greeting, or unclear, output CHAT and stay on the home page.
5. STEP GUIDANCE & FIELD FILLING RULES (CRITICAL):
   - When entering a step for the FIRST TIME (0 fields filled):
     1. State the step name clearly.
     2. Briefly list ALL the details or documents needed in this step.
     3. Ask the user for the FIRST missing field or document to get started.
   - When continuing a HALF-COMPLETED step (some fields filled, some missing):
     1. Acknowledge that we are continuing this step.
     2. Briefly mention which details are already filled.
     3. Ask the user for the details of the NEXT missing field.
   - When a step is COMPLETELY FILLED (all required fields are filled):
     1. Announce that all details for this step are completely filled.
     2. Ask the user: "Do you want to continue to the next step, or check your entered details?"
     3. If they say "check", output CHAT and read out all the field names and their entered details in your conversational message.
     4. If they say "next" (or indicate moving forward), output NEXT to move to the next step.
6. When the user provides details that fill fields, extract ALL mentioned values into 'filled_fields' (in ENGLISH). Acknowledge what was updated.
7. If the user indicates they want to upload a document or file, output the OPEN_FILE_PICKER action with target 'autofill'.
8. If the user indicates they want to scan a document with the camera, output the OPEN_SCANNER action with target 'autofill'.
9. If the SYSTEM sends a message with validation or autofill results, elegantly summarize what was extracted and what remains.
10. CRITICAL FORM FIELD LANGUAGE RULE: All field values in the "filled_fields" object MUST ALWAYS be in English (Latin script/English words). Regardless of whether the user speaks in ${userLanguage} (e.g. Kannada, Hindi, Telugu, Tamil, etc.), you MUST transliterate or translate their input into standard English for the form fields. Examples:
    - Names: "ರಾಹುಲ್" -> "Rahul", "अमित शर्मा" -> "Amit Sharma"
    - Gender / Select options: "ಪುರುಷ" / "पुरुष" -> "Male", "ಮಹಿಳೆ" / "महिला" -> "Female"
    - Addresses / Cities / States: "ಬೆಂಗಳೂರು" -> "Bangalore", "ಕರ್ನಾಟಕ" -> "Karnataka"
    - Numbers, dates, and emails must always use standard English numbers and Latin characters.
11. CRITICAL CONVERSATION LANGUAGE RULE: The 'message' field in your JSON MUST ALWAYS be written strictly and naturally in the user's preferred language: ${userLanguage}. Do NOT write in English if the user's selected language is non-English (e.g., if ${userLanguage} is Kannada, your 'message' must be entirely in Kannada script). Translate your conversational thoughts into ${userLanguage} before returning.
12. NATURAL PHRASING RULE: In your conversational messages, NEVER use the rigid word 'speak' (e.g. avoid 'speak your details'). Always use friendly, natural conversational words like 'tell me', 'say', or 'share' (e.g. 'You can tell me your details, or upload/scan a document'). In non-English languages, use natural expressions for 'tell/say'.
13. DATE OF BIRTH / PARTIAL FIELD RULE: NEVER assume or auto-complete missing date parts (like defaulting the year to 2000, 1999, etc.) when the user provides partial information. If the user only provides month and date (e.g. "26th July"), or only month and year, do NOT output FILL_FIELD for date of birth yet. Instead, output action CHAT and ask the user to specify the missing year, date, or month.

You MUST return ONLY valid JSON matching this exact schema:
{
  "message": "Step transition announcement first, then question for details, strictly in ${userLanguage}",
  "reasoning": "Brief verification...",
  "action": "ACTION_NAME",
  "filled_fields": {
    "optional_field_id": "extracted_value_in_ENGLISH"
  },
  "target": "optional_target (e.g. for NAVIGATE_STEP, NAVIGATE_PAGE, CLEAR_FIELD)"
}
CRITICAL: For fields requiring specific formats (like "YYYY-MM-DD" for dates), you must format the extracted value strictly as requested. If the user provides multiple pieces of information, extract ALL of them into the "filled_fields" object (all in ENGLISH), even if your main action is NAVIGATE_STEP, NEXT, or CHAT. Your conversational 'message' MUST NEVER mention technical formats.
CRITICAL: The "message" field MUST be the very FIRST key in the JSON object, and do NOT use quotes inside the message string.`;
};

export const getLLMAction = async (userInput, context) => {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    throw new Error("MIMO_API_KEY is not defined in environment variables");
  }

  const userLanguage = context.language || "English";

  const systemPrompt = getSystemPrompt(context, userLanguage);

  try {
    const chatHistory = context.chat_history || [];
    // Keep only the last 6 messages (3 turns) to prevent context bloat and speed up inference
    const recentHistory = chatHistory.slice(-6);
    const formattedHistory = recentHistory.map(msg => ({
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
        model: "mimo-v2.5",
        messages: [
          { role: "system", content: systemPrompt },
          ...formattedHistory,
          { role: "user", content: userInput }
        ],
        max_tokens: 512,
        temperature: 0.5, // low temp for predictable JSON
        stream: false,
        thinking: { type: "disabled" }
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

export const getLLMActionStream = async (userInput, context, onSentence) => {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) throw new Error("MIMO_API_KEY is not defined");

  const userLanguage = context.language || "English";
  const systemPrompt = getSystemPrompt(context, userLanguage);

  try {
    const chatHistory = context.chat_history || [];
    const recentHistory = chatHistory.slice(-6);
    const formattedHistory = recentHistory.map(msg => ({
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
        model: "mimo-v2.5",
        messages: [
          { role: "system", content: systemPrompt },
          ...formattedHistory,
          { role: "user", content: userInput }
        ],
        max_tokens: 512,
        temperature: 0.5,
        stream: true,
        thinking: { type: "disabled" }
      })
    });

    if (!response.ok) {
      throw new Error(`LLM Streaming API Error: ${response.status} ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let fullContent = "";
    let processedMessageLength = 0;
    let messageBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkStr = decoder.decode(value, { stream: true });
      const lines = chunkStr.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
              fullContent += data.choices[0].delta.content;

              // Try to extract the message field so far
              const msgMatch = fullContent.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/);
              if (msgMatch) {
                const currentMessage = msgMatch[1];
                const newText = currentMessage.slice(processedMessageLength);

                if (newText.length > 0) {
                  messageBuffer += newText;
                  processedMessageLength = currentMessage.length;

                  // Check for sentence boundaries: ., ?, !, or Kannada/Hindi danda (।)
                  const boundaryMatch = messageBuffer.match(/([.?!।]+[\s]*)/);
                  if (boundaryMatch) {
                    const boundaryIndex = boundaryMatch.index + boundaryMatch[0].length;
                    const sentence = messageBuffer.slice(0, boundaryIndex).trim();
                    messageBuffer = messageBuffer.slice(boundaryIndex);

                    if (sentence.length > 0) {
                      // Unescape any escaped characters (like \n or \")
                      const cleanSentence = sentence.replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                      onSentence(cleanSentence);
                    }
                  }
                }
              }
            }
          } catch (e) {
            // ignore partial json parse errors from SSE chunk
          }
        }
      }
    }

    // Flush remaining buffer
    if (messageBuffer.trim().length > 0) {
      const cleanSentence = messageBuffer.trim().replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      onSentence(cleanSentence);
    }

    // Finally, extract the JSON object
    const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Failed to find JSON object in LLM response: ${fullContent}`);
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Error in getLLMActionStream:", error);
    throw error;
  }
};

export const getGeminiLLMAction = async (userInput, context) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables");
  }

  const userLanguage = context.language || "English";

  const systemPrompt = getSystemPrompt(context, userLanguage);

  try {
    const chatHistory = context.chat_history || [];
    // Keep only the last 6 messages (3 turns) to prevent context bloat and speed up inference
    const recentHistory = chatHistory.slice(-6);
    const formattedHistory = recentHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          ...formattedHistory,
          { role: "user", content: userInput }
        ],
        max_tokens: 512,
        temperature: 0.5,
        stream: false
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
    console.error("Error in getGeminiLLMAction:", error);
    throw error;
  }
};

export const getGeminiLLMActionStream = async (userInput, context, onSentence) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");

  const userLanguage = context.language || "English";
  const systemPrompt = getSystemPrompt(context, userLanguage);

  try {
    const chatHistory = context.chat_history || [];
    const recentHistory = chatHistory.slice(-6);
    const formattedHistory = recentHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          ...formattedHistory,
          { role: "user", content: userInput }
        ],
        max_tokens: 512,
        temperature: 0.5,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`LLM Streaming API Error: ${response.status} ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let fullContent = "";
    let processedMessageLength = 0;
    let messageBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkStr = decoder.decode(value, { stream: true });
      const lines = chunkStr.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
              fullContent += data.choices[0].delta.content;

              // Try to extract the message field so far
              const msgMatch = fullContent.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/);
              if (msgMatch) {
                const currentMessage = msgMatch[1];
                const newText = currentMessage.slice(processedMessageLength);

                if (newText.length > 0) {
                  messageBuffer += newText;
                  processedMessageLength = currentMessage.length;

                  // Check for sentence boundaries: ., ?, !, or Kannada/Hindi danda (।)
                  const boundaryMatch = messageBuffer.match(/([.?!।]+[\s]*)/);
                  if (boundaryMatch) {
                    const boundaryIndex = boundaryMatch.index + boundaryMatch[0].length;
                    const sentence = messageBuffer.slice(0, boundaryIndex).trim();
                    messageBuffer = messageBuffer.slice(boundaryIndex);

                    if (sentence.length > 0) {
                      // Unescape any escaped characters (like \n or \")
                      const cleanSentence = sentence.replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                      onSentence(cleanSentence);
                    }
                  }
                }
              }
            }
          } catch (e) {
            // ignore partial json parse errors from SSE chunk
          }
        }
      }
    }

    // Flush remaining buffer
    if (messageBuffer.trim().length > 0) {
      const cleanSentence = messageBuffer.trim().replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      onSentence(cleanSentence);
    }

    // Finally, extract the JSON object
    const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Failed to find JSON object in LLM response: ${fullContent}`);
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Error in getGeminiLLMActionStream:", error);
    throw error;
  }
};
