import FormSchema from "../models/FormSchema.js";

export const getAllSchemas = async (req, res) => {
  try {
    const schemas = await FormSchema.find({}, "formId title");
    res.status(200).json(schemas);
  } catch (error) {
    res.status(500).json({ message: "Error fetching schemas", error: error.message });
  }
};

export const getSchemaById = async (req, res) => {
  try {
    const schema = await FormSchema.findOne({ formId: req.params.id });
    if (!schema) {
      return res.status(404).json({ message: "Schema not found" });
    }
    res.status(200).json(schema);
  } catch (error) {
    res.status(500).json({ message: "Error fetching schema", error: error.message });
  }
};

export const createSchema = async (req, res) => {
  try {
    const newSchema = new FormSchema(req.body);
    await newSchema.save();
    res.status(201).json(newSchema);
  } catch (error) {
    res.status(500).json({ message: "Error creating schema", error: error.message });
  }
};
