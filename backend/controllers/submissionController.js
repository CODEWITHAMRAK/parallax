import Submission from "../models/Submission.js";
import Draft from "../models/Draft.js";

export const getSubmission = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user.userId;

    const submission = await Submission.findOne({ userId, formId });
    if (!submission) {
      return res.status(200).json(null);
    }

    res.status(200).json(submission);
  } catch (error) {
    console.error("getSubmission error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const submitForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user.userId;
    const { values } = req.body;

    // Check if already submitted
    const existing = await Submission.findOne({ userId, formId });
    if (existing) {
      return res.status(400).json({ error: "Form already submitted" });
    }

    const submission = new Submission({
      userId,
      formId,
      values,
    });
    await submission.save();

    // Delete draft after successful submission
    await Draft.deleteOne({ userId, formId });

    res.status(201).json({ message: "Form submitted successfully" });
  } catch (error) {
    console.error("submitForm error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteSubmission = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user.userId;

    await Submission.deleteOne({ userId, formId });
    await Draft.deleteOne({ userId, formId });

    res.status(200).json({ message: "Submission deleted" });
  } catch (error) {
    console.error("deleteSubmission error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
