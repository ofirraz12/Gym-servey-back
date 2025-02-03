const express = require("express");
const cors = require("cors");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors()); // Allow frontend to access backend

// 🔑 Load Google Sheets Credentials
const creds = JSON.parse(fs.readFileSync("google-credentials.json")); // Ensure this file is in your backend
const SHEET_ID = process.env.GOOGLE_SHEET_ID; // Your Google Sheet ID

// 🔑 Google OAuth2 Credentials for Sending Emails
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || "https://developers.google.com/oauthplayground";
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

// 📧 Function to Send Email
const sendEmail = async (email) => {
  try {
    console.log("📧 Attempting to send email to:", email);

    const accessTokenResponse = await oAuth2Client.getAccessToken();
    if (!accessTokenResponse.token) {
      console.error("❌ Failed to generate access token");
      return;
    }

    console.log("✅ Access token generated:", accessTokenResponse.token);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessTokenResponse.token,
      },
    });

    const mailOptions = {
      from: `"Gym App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Thank You for Participating! 🎉",
      text: `תודה שמילאת את הסקר! 
בימים הקרובים נשלח איימל נוסף ובו נסביר לעומק על האפליקציה והחזון שלנו. 
המשך יום נהדר! 😊

🔹 קוד ההנחה שלך: GYM20`,
    };

    console.log("🚀 Sending email now...");
    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", result);
  } catch (error) {
    console.error("❌ Error sending email:", error);
  }
};

// 🛠 Function to Append Survey Data to Google Sheets
async function saveToGoogleSheets(data) {
  try {
    const doc = new GoogleSpreadsheet(SHEET_ID);
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle["Responses"] || doc.sheetsByIndex[0];

    // Load existing rows
    const rows = await sheet.getRows();
    const existingEmails = rows.map(row => row.email);

    // Prevent duplicate submissions
    if (existingEmails.includes(data.email)) {
      console.log("🔹 Email already exists, skipping duplicate submission.");
      return false;
    }

    // Add new survey row
    await sheet.addRow(data);
    console.log("✅ Survey data saved to Google Sheets.");
    return true;
  } catch (error) {
    console.error("❌ Error saving to Google Sheets:", error);
    return false;
  }
}

// 📌 API Route: Save Survey Responses & Send Email
app.post("/submit", async (req, res) => {
  const {
    age,
    trainingDuration,
    trainingPlan,
    beginnerHelp,
    aiHelp,
    Social,
    trainingChallenge,
    researchInterest,
    email,
  } = req.body;

  try {
    console.log("📝 Received survey submission for:", email);

    // Create new survey object
    const newSurvey = {
      age,
      trainingDuration,
      trainingPlan,
      beginnerHelp,
      aiHelp,
      Social,
      trainingChallenge,
      researchInterest,
      email,
      submittedAt: new Date().toISOString(),
    };

    // Save to Google Sheets
    const saved = await saveToGoogleSheets(newSurvey);
    if (!saved) {
      return res.status(400).json({ error: "Email already submitted." });
    }

    // Send thank-you email
    await sendEmail(email);

    res.json({ success: true, message: "Survey submitted successfully!" });
  } catch (err) {
    console.error("❌ Error handling survey submission:", err);
    res.status(500).json({ error: "Failed to process the survey." });
  }
});

// 🚀 Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
