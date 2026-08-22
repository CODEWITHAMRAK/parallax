import mongoose from "mongoose";
import dotenv from "dotenv";
import FormSchema from "./models/FormSchema.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/codefury";

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing forms
    await FormSchema.deleteMany({});

    const forms = [
      new FormSchema({
        formId: "national_scholarship",
        title: "National Scholarship Application",
        steps: [
          {
            id: "personal",
            title: "Personal Information",
            autofill_document_type: "Aadhaar Card",
            fields: [
              { id: "full_name", label: "Full Name (as per Aadhaar)", type: "text", required: true },
              { id: "date_of_birth", label: "Date of Birth", type: "date", required: true },
              { id: "gender", label: "Gender", type: "select", required: true, options: ["Male", "Female", "Other"] },
              { id: "category", label: "Category", type: "select", required: true, options: ["General", "OBC", "SC", "ST", "Minority"] }
            ]
          },
          {
            id: "academic",
            title: "Academic Details",
            autofill_document_type: "Previous Year Marksheet",
            fields: [
              { id: "institution_name", label: "Current Institution Name", type: "text", required: true },
              { id: "current_course", label: "Current Course / Class", type: "text", required: true },
              { id: "previous_percentage", label: "Previous Year Percentage", type: "number", required: true }
            ]
          },
          {
            id: "financial",
            title: "Financial Details",
            autofill_document_type: "Income Certificate",
            fields: [
              { id: "annual_income", label: "Annual Family Income", type: "number", required: true },
              { id: "bank_account", label: "Bank Account Number", type: "text", required: true },
              { id: "ifsc_code", label: "IFSC Code", type: "text", required: true }
            ]
          },
          {
            id: "documents",
            title: "Document Uploads",
            fields: [
              { id: "aadhaar_doc", label: "Aadhaar Card", type: "file", required: true },
              { id: "income_doc", label: "Income Certificate", type: "file", required: true },
              { id: "marksheet_doc", label: "Previous Year Marksheet", type: "file", required: true }
            ]
          }
        ]
      }),
      new FormSchema({
        formId: "education_loan",
        title: "Student Education Loan Form",
        steps: [
          {
            id: "applicant_details",
            title: "Applicant Information",
            autofill_document_type: "PAN Card",
            fields: [
              { id: "full_name", label: "Applicant Name", type: "text", required: true },
              { id: "pan_number", label: "PAN Number", type: "text", required: true },
              { id: "date_of_birth", label: "Date of Birth", type: "date", required: true },
              { id: "mobile_number", label: "Mobile Number", type: "tel", required: true }
            ]
          },
          {
            id: "course_details",
            title: "Course & Institution Details",
            autofill_document_type: "Admission Letter",
            fields: [
              { id: "institution_name", label: "Institution Name", type: "text", required: true },
              { id: "course_name", label: "Course Name", type: "text", required: true },
              { id: "course_duration", label: "Duration (in years)", type: "number", required: true }
            ]
          },
          {
            id: "financial_details",
            title: "Loan Requirements",
            autofill_document_type: "Fee Structure Receipt",
            fields: [
              { id: "tuition_fees", label: "Total Tuition Fees", type: "number", required: true },
              { id: "hostel_fees", label: "Total Hostel/Boarding Fees", type: "number", required: true },
              { id: "loan_amount", label: "Requested Loan Amount", type: "number", required: true }
            ]
          },
          {
            id: "co_applicant",
            title: "Co-Applicant Details",
            autofill_document_type: "Parent's Salary Slip",
            fields: [
              { id: "co_applicant_name", label: "Parent/Guardian Name", type: "text", required: true },
              { id: "occupation", label: "Occupation", type: "text", required: true },
              { id: "monthly_income", label: "Monthly Income", type: "number", required: true }
            ]
          },
          {
            id: "documents",
            title: "Required Documents",
            fields: [
              { id: "pan_doc", label: "Applicant PAN Card", type: "file", required: true },
              { id: "admission_doc", label: "Admission Letter", type: "file", required: true },
              { id: "fee_doc", label: "Fee Structure", type: "file", required: true },
              { id: "income_doc", label: "Co-Applicant Income Proof", type: "file", required: true }
            ]
          }
        ]
      }),
      new FormSchema({
        formId: "bus_pass",
        title: "Student Bus Pass Application",
        steps: [
          {
            id: "personal",
            title: "Personal Details",
            autofill_document_type: "Aadhaar Card",
            fields: [
              { id: "full_name", label: "Full Name", type: "text", required: true },
              { id: "date_of_birth", label: "Date of Birth", type: "date", required: true },
              { id: "aadhaar_number", label: "Aadhaar Number", type: "text", required: true }
            ]
          },
          {
            id: "institution",
            title: "Institution Verification",
            autofill_document_type: "College ID Card",
            fields: [
              { id: "institution_name", label: "School/College Name", type: "text", required: true },
              { id: "admission_number", label: "Admission / Roll Number", type: "text", required: true },
              { id: "class_course", label: "Class / Course", type: "text", required: true }
            ]
          },
          {
            id: "travel",
            title: "Travel Details",
            autofill_document_type: "Address Proof",
            fields: [
              { id: "source_address", label: "Source (Home Address)", type: "text", required: true },
              { id: "destination", label: "Destination (College Location)", type: "text", required: true },
              { id: "route_number", label: "Preferred Bus Route Number", type: "text", required: false }
            ]
          },
          {
            id: "documents",
            title: "Document Uploads",
            fields: [
              { id: "photo_doc", label: "Passport Size Photograph", type: "file", required: true },
              { id: "college_id_doc", label: "College ID Card", type: "file", required: true },
              { id: "address_doc", label: "Address Proof (Aadhaar)", type: "file", required: true }
            ]
          }
        ]
      })
    ];

    await FormSchema.insertMany(forms);
    console.log("3 Student Application forms seeded successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
