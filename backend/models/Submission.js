import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ["SUBMITTED", "APPROVED", "REJECTED"],
      default: "SUBMITTED",
    },
  },
  { timestamps: true }
);

// A user can only have one active submission per form in this workflow
submissionSchema.index({ userId: 1, formId: 1 }, { unique: true });

export default mongoose.model("Submission", submissionSchema);
