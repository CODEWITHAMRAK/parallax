import Draft from "../models/Draft.js";

export const saveDraft = async (req, res) => {
  try {
    const { formId, values, currentStepIndex } = req.body;
    const userId = req.user.userId; // Fix: decoded token has userId

    if (!formId) {
      return res.status(400).json({ error: "formId is required" });
    }

    const draft = await Draft.findOneAndUpdate(
      { userId, formId },
      { values, currentStepIndex },
      { returnDocument: 'after', upsert: true }
    );

    res.status(200).json({ message: "Draft saved successfully", draft });
  } catch (error) {
    console.error("Error saving draft:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getDraft = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user.userId; // Fix: decoded token has userId

    const draft = await Draft.findOne({ userId, formId });
    if (!draft) {
      return res.status(404).json({ message: "No draft found" });
    }

    res.status(200).json({ draft });
  } catch (error) {
    console.error("Error fetching draft:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
