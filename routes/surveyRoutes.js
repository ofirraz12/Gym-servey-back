const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
require("dotenv").config();

// 📁 Path to surveys.json file
const surveyFilePath = path.join(__dirname, "../data/surveys.json");

// 🛠 Function to Read Existing Surveys
const readSurveys = () => {
  try {
    if (!fs.existsSync(surveyFilePath)) return [];
    const data = fs.readFileSync(surveyFilePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("❌ Error reading surveys.json:", err);
    return [];
  }
};

// 🛠 Function to Save Surveys to JSON File
const saveSurveys = (surveys) => {
  try {
    fs.writeFileSync(surveyFilePath, JSON.stringify(surveys, null, 2), "utf8");
  } catch (err) {
    console.error("❌ Error saving surveys.json:", err);
  }
};

// 🔑 Google OAuth2 Credentials
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
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

// 📌 API Route: Save Survey Responses & Send Email
router.post("/submit", async (req, res) => {
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

    // 📂 Read existing surveys from JSON file
    let surveys = readSurveys();

    // 🧐 Check if email already exists
    const existingUser = surveys.find((s) => s.email === email);

    if (existingUser) {
      console.log("🔹 Email already exists, skipping duplicate submission.");
      return res.status(400).json({ error: "Email already submitted." });
    }

    // 📌 Create new survey object
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

    // ➕ Add new survey to array & save to JSON file
    surveys.push(newSurvey);
    saveSurveys(surveys);

    console.log("✅ Survey data saved to surveys.json");

    // 📧 Send thank-you email
    await sendEmail(email);

    res.json({ success: true, survey: newSurvey });
  } catch (err) {
    console.error("❌ Error handling survey submission:", err);
    res.status(500).json({ error: "Failed to process the survey." });
  }
});

module.exports = router;
