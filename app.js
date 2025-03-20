const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Tesseract = require("tesseract.js");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Configure Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Function to convert text to LaTeX using OpenAI
async function convertToLatex(text) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Convert the following text to LaTeX format.",
          },
          { role: "user", content: text },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return null;
  }
}

// File processing route
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let extractedText = "";

    if (fileExt === ".pdf") {
      const data = await pdfParse(fs.readFileSync(filePath));
      extractedText = data.text;
    } else if (fileExt === ".docx") {
      const data = await mammoth.extractRawText({ path: filePath });
      extractedText = data.value;
    } else if ([".png", ".jpg", ".jpeg"].includes(fileExt)) {
      const {
        data: { text },
      } = await Tesseract.recognize(filePath, "eng");
      extractedText = text;
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    fs.unlinkSync(filePath); // Delete uploaded file after processing

    // Convert extracted text to LaTeX
    const latexCode = await convertToLatex(extractedText);

    console.log("MY CONSOLE: ", latexCode)

    if (latexCode == null) {
      return res.status(500).json({ error: "Failed to convert to LaTeX" });
    }

    res.json({ extractedText, latexCode });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "File processing failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
