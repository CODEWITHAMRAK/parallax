import mongoose from "mongoose";

const FieldSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, required: true }, // 'text', 'number', 'date', 'select', etc.
  required: { type: Boolean, default: false },
  options: [{ type: String }], // For 'select' or 'radio' types
  description: { type: String }
});

const StepSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  autofill_document_type: { type: String, required: false }, // Instructs the LLM on which document can autofill this step
  fields: [FieldSchema]
});

const FormSchemaModel = new mongoose.Schema({
  formId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  steps: [StepSchema]
}, { timestamps: true });

export default mongoose.model("FormSchema", FormSchemaModel);
