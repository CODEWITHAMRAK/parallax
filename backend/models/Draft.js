import mongoose from "mongoose";

const draftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    formId: {
      type: String,
      required: true,
    },
    values: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    currentStepIndex: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
);

// Ensure a user can only have one draft per form
draftSchema.index({ userId: 1, formId: 1 }, { unique: true });

export default mongoose.model("Draft", draftSchema);
