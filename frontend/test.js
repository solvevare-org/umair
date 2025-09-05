// test.js
// Usage: node test.js path/to/file.pdf
const { generateIndexFromPdf } = require("./openai");

(async () => {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: node test.js <pdf-file>");
    process.exit(1);
  }
  try {
    console.log("⏳ Parsing PDF and generating index.html (Candy-Corn style)...");
    await generateIndexFromPdf(pdfPath, { model: "gpt-4o-mini", max_tokens: 8000, temperature: 0.25 });
    console.log("✅ index.html generated successfully.");
  } catch (e) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
})();
