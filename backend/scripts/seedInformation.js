import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Information from "../models/Information.js";
import { getSarvamApiKey } from "../utils/sarvamKeys.js";

dotenv.config(); // Will use .env in backend dir if ran from backend dir

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "../public/audio");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Languages mapping for Sarvam API (Target language code)
const languages = {
  "English": "en-IN",
  "Kannada": "kn-IN",
  "Hindi": "hi-IN",
  "Telugu": "te-IN",
  "Tamil": "ta-IN",
  "Malayalam": "ml-IN"
};

const baseSchemes = [
  {
    category: "education",
    title: { 
      "English": "Vidyasiri Scholarship",
      "Kannada": "ವಿದ್ಯಾಸಿರಿ ವಿದ್ಯಾರ್ಥಿವೇತನ",
      "Hindi": "विद्यासिरी छात्रवृत्ति",
      "Telugu": "విద్యాసిరి స్కాలర్షిప్",
      "Tamil": "வித்யாசிரி உதவித்தொகை",
      "Malayalam": "വിദ്യാസിരി സ്കോളർഷിപ്പ്"
    },
    content: { 
      "English": "Vidyasiri is a Karnataka government scheme providing free hostel accommodation and a monthly stipend for backward class students pursuing higher education.",
      "Kannada": "ವಿದ್ಯಾಸಿರಿ ವಿದ್ಯಾರ್ಥಿವೇತನ - ಹಿಂದುಳಿದ ವರ್ಗಗಳ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಕರ್ನಾಟಕ ಸರ್ಕಾರದ ಉಚಿತ ವಸತಿ ಮತ್ತು ಮಾಸಿಕ ಭತ್ಯೆ ಯೋಜನೆ.",
      "Hindi": "विद्यासिरी छात्रवृत्ति - पिछड़े वर्ग के छात्रों के लिए कर्नाटक सरकार की मुफ्त छात्रावास और मासिक वजीफा योजना।",
      "Telugu": "వెనుకబడిన తరగతుల విద్యార్థులకు ఉచిత హాస్టల్ మరియు స్టైపెండ్ అందించే కర్ణాటక ప్రభుత్వ పథకం.",
      "Tamil": "பின்தங்கிய வகுப்பு மாணவர்களுக்கு இலவச விடுதி மற்றும் உதவித்தொகை வழங்கும் கர்நாடக அரசு திட்டம்.",
      "Malayalam": "പിന്നാക്ക വിഭാഗത്തിലെ വിദ്യാർത്ഥികൾക്ക് സൗജന്യ ഹോസ്റ്റലും സ്റ്റൈപ്പൻഡും നൽകുന്ന കർണാടക സർക്കാർ പദ്ധതി."
    }
  },
  {
    category: "finance",
    title: { 
      "English": "Student Bus Pass Scheme",
      "Kannada": "ವಿದ್ಯಾರ್ಥಿ ಬಸ್ ಪಾಸ್ ಯೋಜನೆ",
      "Hindi": "छात्र बस पास योजना",
      "Telugu": "విద్యార్థి బస్సు పాస్ పథకం",
      "Tamil": "மாணவர் பஸ் பாஸ் திட்டம்",
      "Malayalam": "വിദ്യാർത്ഥി ബസ് പാസ് പദ്ധതി"
    },
    content: { 
      "English": "The Karnataka government offers highly subsidized bus passes for school and college students to ensure affordable daily commute.",
      "Kannada": "ವಿದ್ಯಾರ್ಥಿ ಬಸ್ ಪಾಸ್ ಯೋಜನೆ - ಶಾಲಾ ಮತ್ತು ಕಾಲೇಜು ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ರಿಯಾಯಿತಿ ದರದಲ್ಲಿ ಬಸ್ ಪಾಸ್.",
      "Hindi": "छात्र बस पास योजना - स्कूल और कॉलेज के छात्रों के लिए रियायती दर पर बस पास।",
      "Telugu": "పాఠశాల మరియు కళాశాల విద్యార్థులకు రాయితీ బస్సు పాస్.",
      "Tamil": "பள்ளி மற்றும் கல்லூரி மாணவர்களுக்கு மானிய விலையில் பஸ் பாஸ்.",
      "Malayalam": "സ്കൂൾ, കോളേജ് വിദ്യാർത്ഥികൾക്ക് സബ്സിഡിയോടെയുള്ള ബസ് പാസ്."
    }
  }
];

const translateText = async (text, lang) => {
  // Not used anymore as we hardcoded translations
  return text;
};

const generateAudio = async (text, langCode, filename) => {
  const apiKey = getSarvamApiKey();
  const payload = {
    inputs: [text],
    target_language_code: langCode,
    speaker: "ishita",
    pace: 1.0,
    speech_sample_rate: 8000,
    enable_preprocessing: true,
    model: "bulbul:v3"
  };

  const response = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Sarvam TTS Error for ${langCode}:`, errText);
    return null;
  }

  const data = await response.json();
  if (data.audios && data.audios.length > 0) {
    const base64Audio = data.audios[0];
    const buffer = Buffer.from(base64Audio, 'base64');
    const filepath = path.join(publicDir, filename);
    fs.writeFileSync(filepath, buffer);
    return `/static/audio/${filename}`;
  }
  return null;
};

const seedInformation = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/codefury");
    console.log("Connected to MongoDB");

    await Information.deleteMany({});
    console.log("Cleared existing information");

    for (let i = 0; i < baseSchemes.length; i++) {
      const scheme = baseSchemes[i];
      console.log(`Processing scheme: ${scheme.title["English"]}`);
      
      const audioUrls = {};

      for (const [langName, langCode] of Object.entries(languages)) {
        console.log(` Generating TTS for ${langName}...`);
        
        const translatedContent = scheme.content[langName];
        const filename = `scheme_${i}_${langCode}.wav`;
        const audioUrl = await generateAudio(translatedContent, langCode, filename);
        
        if (audioUrl) {
          audioUrls[langName] = audioUrl;
        } else {
          // Fallback if Sarvam API fails
           audioUrls[langName] = ""; 
        }
      }

      scheme.audioUrls = audioUrls;
      const newInfo = new Information(scheme);
      await newInfo.save();
      console.log(`Saved scheme ${i + 1}`);
    }

    console.log("Seeding Information Provider successful!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedInformation();
