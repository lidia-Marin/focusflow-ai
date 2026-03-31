require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const axios = require('axios');
const qs = require('qs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());


// =====================================
// 🔥 AZURE OPENAI
// =====================================
const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
  defaultQuery: { 'api-version': '2024-02-15-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_KEY }
});

console.log("✅ Azure OpenAI conectado");


// =====================================
// 🧠 ANALYZE
// =====================================
app.post('/analyze', async (req, res) => {
  const { task, profile } = req.body;

  if (!task) return res.status(400).json({ error: "No enviaste tarea" });

  try {
    const response = await client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Eres experto en accesibilidad cognitiva. Responde solo JSON."
        },
        {
          role: "user",
          content: `
Adapta esta tarea según el perfil: ${profile}

TAREA:
${task}

REGLAS:
- mínimo 6 pasos
- cada paso con número (X min)
- sin markdown

RESPONDE SOLO JSON:
{
  "steps": [
    { "text": "texto", "time": 5 }
  ],
  "explanation": "explicación simple",
  "tone": "tipo lenguaje"
}
`
        }
      ],
      temperature: 0.6
    });

    let text = response.choices[0].message.content;

    text = text.replace(/```json|```/g, '').trim();

    const data = JSON.parse(text);

    const steps = data.steps.map(s => ({
      text: s.text,
      time: parseInt(s.time) || 5,
      done: false
    }));

    const total = steps.reduce((acc, s) => acc + s.time, 0);

    res.json({
      difficulty: "Dinámica",
      totalTime: `${total} min`,
      steps,
      explanation: data.explanation,
      tone: data.tone
    });

  } catch (err) {

    console.log("⚠️ FALLBACK ACTIVADO");

    res.json({
      difficulty: "Fallback",
      totalTime: "15 min",
      steps: [
        { text: "Leer tarea", time: 5, done: false },
        { text: "Dividir en partes", time: 5, done: false },
        { text: "Ejecutar", time: 5, done: false }
      ],
      explanation: "Modo seguro",
      tone: "simple"
    });
  }
});


// =====================================
// 📖 IMMERSIVE READER (CORRECTO CON ENTRA ID)
// =====================================
app.get('/getimmersivereaderlaunchparams', async (req, res) => {

  try {
    const response = await axios.post(
      `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        scope: 'https://cognitiveservices.azure.com/.default'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const token = response.data.access_token;

    res.json({
      token: token,
      subdomain: process.env.SUBDOMAIN
    });

  } catch (error) {
    console.error("❌ ERROR REAL:", error.response?.data || error.message);
    res.status(500).send("Error en Reader");
  }
});


// =====================================
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
});