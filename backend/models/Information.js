import mongoose from "mongoose";

const informationSchema = new mongoose.Schema(
  {
    title: {
      type: Map,
      of: String, // Map of language code to title, e.g., { "en": "...", "kn": "..." }
      required: true,
    },
    content: {
      type: Map,
      of: String, // Map of language code to content
      required: true,
    },
    audioUrls: {
      type: Map,
      of: String, // Map of language code to audio URL
      default: {},
    },
    category: {
      type: String,
      default: "general",
    }
  },
  { timestamps: true }
);

export default mongoose.model("Information", informationSchema);
