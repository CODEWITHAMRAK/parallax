import { apiFetch } from "./api.js";

export const fetchAllSchemas = async () => {
  const response = await apiFetch(`/api/schemas`);
  if (!response.ok) {
    throw new Error(`Failed to fetch schemas: ${response.statusText}`);
  }
  return await response.json();
};

export const fetchFormSchema = async (formId) => {
  const response = await apiFetch(`/api/schemas/${formId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch schema: ${response.statusText}`);
  }
  return await response.json();
};

export const fetchChatAction = async (userInput, context) => {
  const response = await apiFetch(`/api/chat`, {
    method: "POST",
    body: JSON.stringify({ userInput, context })
  });
  if (!response.ok) {
    throw new Error(`Failed to get action: ${response.statusText}`);
  }
  return await response.json();
};

export const fetchChatActionStream = async (userInput, context, onSentence) => {
  const response = await apiFetch(`/api/chat/stream`, {
    method: "POST",
    body: JSON.stringify({ userInput, context })
  });

  if (!response.ok) {
    throw new Error(`Failed to get action stream: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let finalAction = null;
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      // Process any remaining buffer
      if (buffer) {
        const lines = buffer.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") continue;
            try {
              const data = JSON.parse(jsonStr);
              if (data.type === "sentence" && onSentence) {
                onSentence(data.text);
              } else if (data.type === "action") {
                finalAction = data.data;
              }
            } catch (e) {}
          }
        }
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("data: ")) {
        const jsonStr = trimmedLine.slice(6);
        if (jsonStr === "[DONE]") continue;
        try {
          const data = JSON.parse(jsonStr);
          if (data.type === "sentence" && onSentence) {
            onSentence(data.text);
          } else if (data.type === "action") {
            finalAction = data.data;
          } else if (data.type === "error") {
            throw new Error(data.message);
          }
        } catch (e) {
          // ignore incomplete json from chunk boundaries
        }
      }
    }
  }

  return finalAction;
};

export const saveDraft = async (formId, values, currentStepIndex) => {
  const response = await apiFetch(`/api/drafts/save`, {
    method: "POST",
    body: JSON.stringify({ formId, values, currentStepIndex })
  });
  if (!response.ok) {
    throw new Error(`Failed to save draft: ${response.statusText}`);
  }
  return await response.json();
};

export const getDraft = async (formId) => {
  const response = await apiFetch(`/api/drafts/${formId}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch draft: ${response.statusText}`);
  }
  return await response.json();
};

export const updateUserLanguage = async (language) => {
  const response = await apiFetch(`/api/user/language`, {
    method: "PUT",
    body: JSON.stringify({ language })
  });
  if (!response.ok) {
    throw new Error(`Failed to update language: ${response.statusText}`);
  }
  return await response.json();
};

export const getUserProfile = async () => {
  const response = await apiFetch(`/api/user/me`);
  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.statusText}`);
  }
  return await response.json();
};

export const autofillFromDocumentApi = async (fileDataUrl, fields) => {
  const response = await apiFetch(`/api/upload/autofill`, {
    method: "POST",
    body: JSON.stringify({ fileDataUrl, fields })
  });
  if (!response.ok) {
    throw new Error(`Failed to autofill document: ${response.statusText}`);
  }
  return await response.json();
};
