import { apiFetch } from "./api.js";

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
