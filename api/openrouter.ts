export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, language, model, prompt } = req.body || {};

    if (!code) {
      return res.status(400).json({ error: 'Missing code' });
    }

    const selectedModel =
      model && model !== 'OpenRouter Auto'
        ? model
        : 'nvidia/nemotron-3-super-120b-a12b:free';

    const systemPrompt = `
You are a senior debugging agent.
Return strict JSON only.
Find syntax errors, logic bugs, unsafe code, and propose a corrected version.

JSON format:
{
  "issues": [
    {
      "id": 1,
      "type": "string",
      "severity": "Critical|High|Medium|Low",
      "description": "string",
      "explanation": "string",
      "original": "string",
      "fixed": "string"
    }
  ],
  "fixedCode": "string",
  "summary": "string"
}
`;

    const userPrompt = `
Language: ${language || 'auto'}

Task: Analyze and fix this code.

${prompt ? `Extra instruction: ${prompt}\n` : ''}

Code:
${code}
`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'OpenRouter request failed',
        details: data
      });
    }

    const text = data?.choices?.[0]?.message?.content;

    if (!text) {
      return res.status(500).json({ error: 'Empty model response', details: data });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: 'Model did not return valid JSON',
        raw: text
      });
    }

    return res.status(200).json(parsed);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Server error',
      details: error?.message || 'Unknown error'
    });
  }
}
