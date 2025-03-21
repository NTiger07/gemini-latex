const express = require("express");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Tesseract = require("tesseract.js");
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

async function convertImageToLatexGemini(path) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const temperature = 0.9
    const prompt =
      "Convert the given mathematical expression into a well-structured LaTeX document that is fully compatible with Overleaf. Ensure proper formatting, include necessary packages, and wrap the equation inside a document structure. The output should be a minimal but complete LaTeX document. The beginning should not include ```latex";
    const result = await model.generateContent([prompt, path], temperature);
    const response = await result.response;
    let latex = response.text();
    latex = latex.replace("```latex\n", '');
    return latex;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
}

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    let latexCode = ""

    if ([".png", ".jpg", ".jpeg"].includes(fileExt)) {
      latexCode = await convertImageToLatexGemini(filePath);
      const texFilePath = path.join(
        outputDir,
        `${path.basename(filePath, fileExt)}.tex`
      );
      fs.writeFileSync(texFilePath, latexCode);
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    fs.unlinkSync(filePath);

    if (!latexCode) {
      return res.status(500).json({ error: "Failed to convert to LaTeX" });
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
