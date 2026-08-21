import mongoose from "mongoose";
import dotenv from "dotenv";
import FormSchema from "./models/FormSchema.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/codefury";

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing scholarship form if it exists
    await FormSchema.deleteOne({ formId: "scholarship_application" });

    const scholarshipForm = new FormSchema({
      formId: "scholarship_application",
      title: "Scholarship Application Form",
      steps: [
        {
          id: "personal",
          title: "Personal Information",
          fields: [
            { id: "full_name", label: "Full Name", type: "text", required: true },
            { id: "email", label: "Email Address", type: "email", required: true },
            { id: "phone_number", label: "Phone Number", type: "tel", required: true },
            { id: "date_of_birth", label: "Date of Birth", type: "date", required: true },
            { id: "category", label: "Category", type: "select", required: true, options: ["General", "OBC", "SC", "ST"] }
          ]
        },
        {
          id: "academic",
          title: "Academic Information",
          fields: [
            { id: "school_name", label: "Current School / College", type: "text", required: true },
            { id: "current_grade", label: "Current Grade / Year", type: "select", required: true, options: ["10th", "11th", "12th", "UG 1st Year", "UG 2nd Year", "UG 3rd Year", "UG 4th Year", "PG"] },
            { id: "previous_percentage", label: "Previous Year Percentage", type: "number", required: true }
          ]
        },
        {
          id: "financial",
          title: "Financial Information",
          fields: [
            { id: "annual_income", label: "Annual Family Income", type: "number", required: true },
            { id: "income_certificate", label: "Income Certificate Details", type: "text", required: false }
          ]
        },
        {
          id: "documents",
          title: "Document Uploads",
          fields: [
            { id: "income_document", label: "Income Certificate Proof", type: "file", required: true },
            { id: "caste_document", label: "Caste Certificate Proof", type: "file", required: false },
            { id: "marksheet_document", label: "Previous Year Marksheet", type: "file", required: true }
          ]
        }
      ]
    });

    await scholarshipForm.save();
    console.log("Scholarship FormSchema seeded successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
