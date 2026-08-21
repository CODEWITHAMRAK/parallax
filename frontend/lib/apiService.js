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
