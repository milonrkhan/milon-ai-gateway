const http = require("http");

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(body);
}

async function brain(text, context) {
  if (!API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const system = `
You are MILON AI ULTIMATE.
Understand Bengali, Banglish, Hindi and English.

Return ONLY valid JSON:
{
  "intent": "CHAT|OPEN_APP|CALL|SMS|WEB_SEARCH|REMINDER|TIME|DATE|WEATHER|UNKNOWN",
  "reply": "short natural Bengali reply",
  "confidence": 0.0,
  "slots": {}
}

Never invent contact details.
Never invent personal information.
For device actions, create a plan only.
The Android Action Engine will perform the actual action.
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "system",
          content: system
        },
        {
          role: "user",
          content: JSON.stringify({
            text: text,
            context: context || {}
          })
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("OpenAI HTTP " + response.status + ": " + errorText);
  }

  const data = await response.json();

  let output = data.output_text || "";

  if (!output && Array.isArray(data.output)) {
    output = data.output
      .flatMap(x => x.content || [])
      .filter(x => x.type === "output_text")
      .map(x => x.text)
      .join("");
  }

  const first = output.indexOf("{");
  const last = output.lastIndexOf("}");

  if (first >= 0 && last > first) {
    output = output.substring(first, last + 1);
  }

  return JSON.parse(output);
}

const server = http.createServer((req, res) => {

  if (req.method === "OPTIONS") {
    return send(res, 204, {});
  }

  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, {
      ok: true,
      service: "MILON AI Gateway",
      version: "1.0"
    });
  }

  if (req.method !== "POST" || req.url !== "/brain") {
    return send(res, 404, {
      ok: false,
      error: "Not found"
    });
  }

  let body = "";

  req.on("data", chunk => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const data = JSON.parse(body || "{}");

      if (!data.text) {
        return send(res, 400, {
          ok: false,
          error: "text is required"
        });
      }

      const result = await brain(
        data.text,
        data.context
      );

      return send(res, 200, {
        ok: true,
        result: result
      });

    } catch (error) {
      return send(res, 500, {
        ok: false,
        error: error.message
      });
    }
  });
});

server.listen(PORT, () => {
  console.log("MILON AI Gateway running on port " + PORT);
});
