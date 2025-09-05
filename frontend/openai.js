// openai.js
require("dotenv").config();

let _fetch = globalThis.fetch;
try { if (!_fetch) _fetch = require("node-fetch").default; } catch (e) {}

const fs = require("fs").promises;
const path = require("path");
const express = require('express');
const multer = require('multer');
const app = express();

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = file.mimetype.startsWith('image/') ? 'uploads/images' : 'uploads/pdfs';
        fs.mkdir(dir, { recursive: true }).then(() => cb(null, dir));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });


let pdfParse;
try { pdfParse = require("pdf-parse"); } catch (e) { /* handled below */ }

// Add Tesseract.js for image OCR
let Tesseract;
try { Tesseract = require("tesseract.js"); } catch (e) { /* handled below */ }
// Extract text from image using Tesseract.js
async function extractImageText(filePath) {
  if (!Tesseract) throw new Error("tesseract.js is not installed. Run: npm install tesseract.js");
  const normalized = path.resolve(String(filePath).replace(/\\/g, "/"));
  const { data: { text } } = await Tesseract.recognize(normalized, "eng");
  if (!text || !text.trim()) throw new Error("No text extracted from image");
  return text.trim();
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY not set. Create .env with OPENAI_API_KEY=sk-...");
}

function stripCodeFences(s) {
  if (!s) return s;
  return s.replace(/^```(?:html|HTML|json)?\s*/i, "").replace(/```$/i, "");
}
function looksLikeHtml(s) {
  if (!s) return false;
  const t = s.trim();
  return /^<!DOCTYPE html>/i.test(t) || /<html[\s>]/i.test(t);
}
function wrapIfNotHtml(content) {
  const safe = (content || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Worksheet (fallback)</title><style>body{font-family:system-ui;padding:20px;background:#fff}pre{white-space:pre-wrap}</style></head><body><h2>Model output (not valid HTML)</h2><pre>${safe}</pre></body></html>`;
}

// Serve static files
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// Store quizzes in memory (in production, use a database)
const quizzes = new Map();
const verifiedEmails = new Set();

// Handle file uploads
// app.post('/upload', upload.fields([
//   { name: 'pdf', maxCount: 1 },
//   { name: 'image', maxCount: 1 }
// ]), async (req, res) => {
//   try {
//     const files = req.files;
//     const response = {
//       message: 'Processing files',
//       files: {},
//       quizData: null
//     };

//     // Handle PDF upload and processing
//     if (files.pdf) {
//       const pdfFile = files.pdf[0];
//       response.files.pdf = pdfFile.filename;
//       try {
//         // Extract text from PDF
//         const pdfText = await extractPdfText(pdfFile.path);
//         console.log("Extracted PDF text:", pdfText); // <-- Add this line
//         // Process with OpenAI to generate quiz JSON
//         const messages = [
//           {
//             role: "system",
//             content: "You are an expert in creating educational quizzes. Convert the following content into a quiz format. Return only valid JSON with the following structure: { title: string, description: string, questions: [{ question: string, options: string[], correctAnswer: number, explanation: string }] }"
//           },
//           {
//             role: "user",
//             content: pdfText
//           }
//         ];
//         const openAIResponse = await callOpenAI(messages, {
//           temperature: 0.7,
//           max_tokens: 2000
//         });
//         let quizData;
//         try {
//           quizData = JSON.parse(openAIResponse);
//         } catch (e) {
//           // fallback: try to extract JSON from code block
//           const match = openAIResponse.match(/```json([\s\S]*?)```/i);
//           if (match) {
//             quizData = JSON.parse(match[1]);
//           } else {
//             throw new Error('OpenAI did not return valid JSON');
//           }
//         }
//         // Generate a unique ID for the quiz
//         const quizId = Date.now().toString(36) + Math.random().toString(36).substr(2);
//         quizzes.set(quizId, quizData);
//         response.quizData = quizData;
//         response.quizId = quizId;
//       } catch (error) {
//         console.error('Error processing PDF:', error);
//         response.pdfError = 'Error processing PDF content';
//       }
//     }


//     // Handle image upload and processing
//     if (files.image) {
//       const imageFile = files.image[0];
//       response.files.image = imageFile.filename;
//       try {
//         // Extract text from image using Tesseract.js
//         const imageText = await extractImageText(imageFile.path);

//         // Process with OpenAI to generate quiz JSON
//         const messages = [
//           {
//             role: "system",
//             content: "You are an expert in creating educational quizzes. Convert the following content into a quiz format. Return only valid JSON with the following structure: { title: string, description: string, questions: [{ question: string, options: string[], correctAnswer: number, explanation: string }] }"
//           },
//           {
//             role: "user",
//             content: imageText
//           }
//         ];

//         const openAIResponse = await callOpenAI(messages, {
//           temperature: 0.7,
//           max_tokens: 2000
//         });

//         // Parse the response into JSON
//         let quizData;
//         try {
//           quizData = JSON.parse(openAIResponse);
//         } catch (e) {
//           // fallback: try to extract JSON from code block
//           const match = openAIResponse.match(/```json([\s\S]*?)```/i);
//           if (match) {
//             quizData = JSON.parse(match[1]);
//           } else {
//             throw new Error('OpenAI did not return valid JSON');
//           }
//         }

//         // Generate a unique ID for the quiz
//         const quizId = Date.now().toString(36) + Math.random().toString(36).substr(2);
//         quizzes.set(quizId, quizData);

//         response.quizData = quizData;
//         response.quizId = quizId;
//       } catch (error) {
//         console.error('Error processing image:', error);
//         response.imageError = 'Error processing image content';
//       }
//     }

//     res.json(response);
//   } catch (error) {
//     console.error('Upload error:', error);
//     res.status(500).json({ error: 'Error uploading and processing files' });
//   }
// });

// Generate shareable link for a quiz
app.post('/generate-link/:quizId', (req, res) => {
  const { quizId } = req.params;
  if (!quizzes.has(quizId)) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  
  const shareableLink = `${req.protocol}://${req.get('host')}/quiz/${quizId}`;
  res.json({ shareableLink });
});

// Verify student email
app.post('/verify-email', (req, res) => {
  const { email, quizId } = req.body;
  if (!email || !quizId) {
    return res.status(400).json({ error: 'Email and quizId are required' });
  }
  
  // In production, implement proper email verification
  verifiedEmails.add(email);
  res.json({ verified: true });
});

// Get quiz data for verified students
app.get('/quiz/:quizId', (req, res) => {
  const { quizId } = req.params;
  const { email } = req.query;
  
  if (!verifiedEmails.has(email)) {
    return res.status(403).json({ error: 'Email not verified' });
  }
  
  const quizData = quizzes.get(quizId);
  if (!quizData) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  
  res.sendFile(path.join(__dirname, 'template.html'));
});

// Start the server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

async function extractPdfText(filePath) {
  if (!pdfParse) throw new Error("pdf-parse is not installed. Run: npm install pdf-parse");
  const normalized = path.resolve(String(filePath).replace(/\\/g,"/"));
  const buf = await fs.readFile(normalized);
  const data = await pdfParse(buf);
  const text = (data.text || "").trim();
  if (!text) throw new Error("No text extracted from PDF");
  return text;
}

async function callOpenAI(messages, opts = {}) {
  if (!_fetch) throw new Error("fetch not available");
  const payload = {
    model: opts.model || "gpt-5",
    messages,
    temperature: typeof opts.temperature === "number" ? opts.temperature : 0.25,
  };
  const res = await _fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${txt}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/* ---------- Stage 1: PDF -> JSON ---------- */
function stage1System() {
  return `You are a strict extractor. Return ONLY valid JSON (no markdown, no explanation). Schema:

{
  "title":"Worksheet title",
  "topic":"short topic",
  "passage":"full passage text (preserve paragraphs and inline math)",
  "questions":[
    {
      "id":"q1",
      "type":"short-answer|long-answer|multiple-choice|numeric|matching|fill-in",
      "text":"Question text (single field)",
      "subQuestions":[{"label":"a","text":"..."}], // optional
      "options":["A","B"], // only for multiple-choice
      "correct":"canonical answer or array",
      "rubric":"short rubric",
      "points":1
    }
  ]
}

Ensure JSON is parseable.`;
}

async function stage1ExtractJson(pdfText, opts = {}) {
  const messages = [
    { role: "system", content: stage1System() },
    { role: "user", content: `Extract passage and questions from this text into the JSON schema above.\n\nTEXT:\n${pdfText}` }
  ];
  let out = await callOpenAI(messages, opts);
  out = stripCodeFences(out).trim();
  try { return JSON.parse(out); } catch (e) {
    // retry stricter
    const retry = [
      { role: "system", content: stage1System() + "\nADDITIONAL: Your response must be valid JSON only." },
      { role: "user", content: `Again: extract JSON from the text.\n\nTEXT:\n${pdfText}` }
    ];
    out = await callOpenAI(retry, opts);
    out = stripCodeFences(out).trim();
    try { return JSON.parse(out); } catch (e2) {
      throw new Error("Stage1: failed to parse JSON from model");
    }
  }
}

/* ---------- Stage 2: Inject JSON into template ---------- */
function stage2System() {
  return `You are a template filler. DO NOT change CSS or JS outside placeholders. Return ONLY a complete HTML document starting with <!DOCTYPE html>.

Placeholders in the template:
<!-- PASSAGE_PLACEHOLDER -->
<!-- QUESTIONS_PLACEHOLDER -->
<!-- ANSWERS_PLACEHOLDER -->

Replace only those placeholders. Keep other HTML/CSS/JS untouched. Return raw HTML only.`;
}

async function stage2Inject(templateHtml, jsonObj, opts = {}) {
  // Try letting model inject first (preferred)
  const messages = [
    { role: "system", content: stage2System() },
    { role: "user", content: `TEMPLATE_START\n${templateHtml}\nTEMPLATE_END\n\nJSON_START\n${JSON.stringify(jsonObj)}\nJSON_END\n\nINSTRUCTIONS: Replace placeholders as described. Return the final HTML only.` }
  ];
  try {
    let out = await callOpenAI(messages, opts);
    out = stripCodeFences(out);
    if (looksLikeHtml(out)) return out;
    // fallback to local injection
  } catch (e) {
    // continue to local injection fallback
  }
  // Local injection fallback (safe)
  const passageHtml = (jsonObj.passage || "").split(/\n{2,}/).map(p => `<p>${escapeHtml(p.trim())}</p>`).join("\n");
  const qHtml = (Array.isArray(jsonObj.questions) ? jsonObj.questions : []).map(q => makeQuestionCardHtml(q)).join("\n");
  const answersObj = {};
  (jsonObj.questions || []).forEach(q => {
    answersObj[q.id] = { correct: q.correct || "", rubric: q.rubric || "", points: q.points || 1, type: q.type || "short-answer" };
  });
  const answersScript = `<script>\nconst ANSWERS = ${JSON.stringify(answersObj, null, 2)};\n</script>`;
  let injected = templateHtml.replace("<!-- PASSAGE_PLACEHOLDER -->", passageHtml);
  injected = injected.replace("<!-- QUESTIONS_PLACEHOLDER -->", qHtml);
  injected = injected.replace("<!-- ANSWERS_PLACEHOLDER -->", answersScript);
  return injected;
}

function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

function makeQuestionCardHtml(q){
  const id = q.id || "q?";
  const pts = q.points || 1;
  if (q.type === "multiple-choice") {
    const opts = (q.options||[]).map((o,i)=>`<label><input type="radio" name="${id}" value="${String.fromCharCode(97+i)}"/> ${String.fromCharCode(97+i)}. ${escapeHtml(o)}</label>`).join("\n");
    return `<div class="q" id="${id}" data-points="${pts}">
  <h3>${escapeHtml(q.text)}</h3>
  <div class="options" role="group">${opts}</div>
  <div class="actions">
    <button class="btn secondary" onclick="aiHelp('${id}')">AI Help</button>
    <button class="btn" onclick="checkAnswer('${id}')">Check</button>
    <span class="score-pill" id="pill-${id}">Score: –</span>
  </div>
  <div class="aiout" id="out-${id}" hidden></div>
</div>`;
  } else {
    return `<div class="q" id="${id}" data-points="${pts}">
  <h3>${escapeHtml(q.text)}</h3>
  <textarea placeholder="Type your answer here..."></textarea>
  <div class="actions">
    <button class="btn secondary" onclick="aiHelp('${id}')">AI Help</button>
    <button class="btn" onclick="checkAnswer('${id}')">Check</button>
    <span class="score-pill" id="pill-${id}">Score: –</span>
  </div>
  <div class="aiout" id="out-${id}" hidden></div>
</div>`;
  }
}

/* ---------- Orchestration ---------- */
async function generateIndexFromPdf(pdfPath, opts = {}) {
  // 1) extract text
  const pdfText = await extractPdfText(pdfPath);

  // 2) stage1: structured JSON
  const json = await stage1ExtractJson(pdfText, opts);

  // 3) read template
  const templatePath = path.resolve(process.cwd(), "template.html");
  let templateHtml = await fs.readFile(templatePath, "utf8");

  // 4) stage2: inject
  const html = await stage2Inject(templateHtml, json, opts);

  // 5) ensure HTML
  const finalHtml = looksLikeHtml(html) ? html : wrapIfNotHtml(html);

  // 6) write index.html
  await fs.writeFile(path.resolve(process.cwd(), "index.html"), finalHtml, "utf8");
  return finalHtml;
}


module.exports = {
  generateIndexFromPdf,
  extractPdfText,
  extractImageText, // Export the new function
  stage1ExtractJson,
  stage2Inject
};
