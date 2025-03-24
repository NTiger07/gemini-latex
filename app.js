const express = require("express");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

const upload = multer({ dest: "uploads/" });
const outputDir = path.join(__dirname, "output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Initialize Google Gemini
const genAI = new GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);

function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

async function convertImageToLatex(filesArray) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const temperature = 0.9;
    const prompt =
      "Combine the given mathematical expressions in the images into a well-structured LaTeX document that is fully compatible with Overleaf. Ensure proper formatting, include necessary packages, and wrap the equations inside a document structure. The output should be a minimal but complete LaTeX document.";
    const imageParts = [filesArray.map((file) => (fileToGenerativePart(file.path, file.mimetype)))];
    const result = await model.generateContent(
      [prompt, ...imageParts],
      temperature
    );
    const response = result.response;
    let latex = response.text();
    latex = latex.replace("```latex\n", "");
    return latex;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
}

app.post("/upload", upload.array("file", 5), async (req, res) => {
  try {
    if (!req.files) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const files = req.files;

    const latexCode = await convertImageToLatex(files);
    const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
    const texFilePath = path.join(
      outputDir,
      `${timestamp}.tex`
    );
    fs.writeFileSync(texFilePath, latexCode);
    files.map((file) => (fs.unlinkSync(file.path)));
    if (!latexCode) {
      return res.status(500).json({ error: "Failed to convert to Latex" });
    }
    res.json({ latexCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "File processing failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
