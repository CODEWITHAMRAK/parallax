import Information from "../models/Information.js";

export const getInformation = async (req, res) => {
  try {
    const infoList = await Information.find().sort({ createdAt: -1 });
    res.status(200).json(infoList);
  } catch (error) {
    console.error("getInformation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
