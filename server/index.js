require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'http://localhost:4200', // desarrollo
    'https://focusflow-ai-pi.vercel.app' // tu frontend en Vercel
  ]
}));
app.use(express.json());

let client = null;

try {
  client = new OpenAI({
    apiKey: process.env.AZURE_OPENAI_KEY,
    baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
    defaultQuery: { 'api-version': '2024-02-15-preview' },
    defaultHeaders: {
      'api-key': process.env.AZURE_OPENAI_KEY
    }
  });
} catch (err) {
  console.log("⚠️ Sin OpenAI, usando fallback");
}

function generateFallback(task) {
  return [
    { text: `Leer tarea: ${task}`, time: "5", type: "action" },
    { text: "Dividir en partes", time: "5", type: "action" },
    { text: "Primer paso", time: "10", type: "action" },
    { text: "Descanso corto", time: "5", type: "break" },
    { text: "Continuar", time: "5", type: "action" }
  ];
}

app.post('/analyze', async (req, res) => {
  const { task, profile } = req.body;

  if (!task) {
    return res.status(400).json({ error: "Tarea inválida" });
  }

  let rules = '';

  if (profile === 'adhd') {
    rules = "Pasos muy cortos, con descansos frecuentes.";
  }
  if (profile === 'autism') {
    rules = "Estructura clara, ordenada y predecible.";
  }
  if (profile === 'dyslexia') {
    rules = "Lenguaje simple, frases cortas.";
  }

  if (!client) {
    return res.json({
      difficulty: "fácil",
      totalTime: "25 min",
      steps: generateFallback(task),
      explanation: "Se simplificó la tarea para facilitar el enfoque."
    });
  }

  try {
    const response = await Promise.race([
      client.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "Ayudas a reducir carga cognitiva con lenguaje calmado."
          },
          {
            role: "user",
            content: `
Tarea: ${task}

${rules}

Divide en pasos simples con tiempo en minutos.
Formato:
1. Paso (X min)
`
          }
        ]
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10000)
      )
    ]);

    const text = response.choices[0].message.content;

    const steps = text.split('\n')
      .filter(l => l.trim())
      .map(line => {
        const match = line.match(/\((\d+)\s*min\)/);
        const time = match ? match[1] : "5";

        return {
          text: line,
          time,
          type: line.toLowerCase().includes("descanso") ? "break" : "action"
        };
      });

    const total = steps.reduce((acc, s) => acc + parseInt(s.time), 0);

    res.json({
      difficulty: "media",
      totalTime: `${total} min`,
      steps,
      explanation: "Dividí la tarea para reducir carga mental y mejorar enfoque."
    });

  } catch (err) {
    res.json({
      difficulty: "fácil",
      totalTime: "25 min",
      steps: generateFallback(task),
      explanation: "Se usó método simple para evitar sobrecarga."
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`🚀 http://localhost:${PORT}`);
});