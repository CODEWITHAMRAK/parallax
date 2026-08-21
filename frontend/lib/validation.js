export const validateField = (fieldSchema, value) => {
  if (fieldSchema.required && (value === undefined || value === null || value === "")) {
    return { valid: false, error: `${fieldSchema.label} is required.` };
  }
  
  if (value === undefined || value === null || value === "") {
    return { valid: true };
  }

  switch (fieldSchema.type) {
    case "number":
      if (isNaN(Number(value))) {
        return { valid: false, error: `${fieldSchema.label} must be a valid number.` };
      }
      break;
    case "date":
      if (isNaN(Date.parse(value))) {
        return { valid: false, error: `${fieldSchema.label} must be a valid date.` };
      }
      break;
    case "select":
    case "radio":
      if (fieldSchema.options && !fieldSchema.options.includes(value)) {
        return { valid: false, error: `Invalid option for ${fieldSchema.label}.` };
      }
      break;
    default:
      break;
  }
  return { valid: true };
};
