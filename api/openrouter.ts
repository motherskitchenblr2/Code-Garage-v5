export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, language, model, agentMode, skill, plugin, customPrompt } = req.body || {};

  if (!code) {
    return res.status(400).json({ error: 'Missing code' });
  }

  // Smart model routing based on code characteristics
  const lines = code.split('\n').length;
  const hasSecurityKeywords = /eval\(|innerHTML|dangerouslySet|exec\(|password|secret|token/i.test(code);
  
  let selectedModel = model && model !== 'openrouter/auto' 
    ? model 
    : (
        hasSecurityKeywords 
          ? 'qwen/qwen3-coder:free' 
          : lines > 200 
            ? 'qwen/qwen3-coder:free'
            : lines > 50 
              ? 'meta-llama/llama-3.3-70b-instruct:free' 
              : 'mistralai/mistral-7b-instruct:free'
      );

  // Skill-based system prompt (token-efficient, compressed)
  const skillMap: Record<string, string> = {
    'Syntax Repair': 'Focus: syntax errors, off-by-one, null access, undefined vars.',
    'Bug Isolation': 'Focus: logic bugs, wrong output, incorrect conditions, edge cases.',
    'Patch Generator': 'Focus: generate minimal fix patches for identified issues.',
    'Fix Verification': 'Focus: verify fixes are correct, no regressions introduced.',
    'Root Cause Drilldown': 'Focus: deep analysis of root cause, not just symptoms.',
    'Regression Guard': 'Focus: check if fix introduces new bugs or breaks existing code.',
  };

  const systemPrompt = `Role: Senior debug agent. Return ONLY valid JSON. No markdown. No prose.
${skillMap[skill] || 'Focus: all bug types equally.'}
${plugin ? `Active Plugin Diagnostic: Apply specialized logic checks for "${plugin}".` : ''}

Output schema:
{
  "issues": [
    {
      "id": 1,
      "type": "string",
      "severity": "Critical|High|Medium|Low",
      "line": 0,
      "description": "string",
      "original": "string",
      "fixed": "string",
      "explanation": "string"
    }
  ],
  "fixedCode": "string",
  "summary": "string"
}

Rules:
- Max 10 issues
- severity=Critical means crash/security
- High=wrong output
- Medium=perf/smell
- Low=style
- Truncate fixedCode if >200 lines`;

  let userPrompt = `Language: ${language || 'auto'}\nMode: ${agentMode || 'assist'}\n\nCode:\n${code}`;
  if (customPrompt) {
    userPrompt += `\n\nUser Question/Instruction:\n${customPrompt}\nPlease address this instruction specifically in your JSON "summary" response output.`;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://codeeditorv5bydesignarenaai.vercel.app',
        'X-Title': 'VOLT CODE AI'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 2048
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'OpenRouter error', 
        details: data 
      });
    }

    const text = data?.choices?.[0]?.message?.content;
    const usage = data?.usage || {};

    if (!text) {
      return res.status(500).json({ 
        error: 'Empty model response', 
        details: data 
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // If model returns markdown-wrapped JSON, try to extract
      const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[1]);
        } catch {
          return res.status(500).json({ 
            error: 'Model did not return valid JSON', 
            raw: text 
          });
        }
      } else {
        return res.status(500).json({ 
          error: 'Model did not return valid JSON', 
          raw: text 
        });
      }
    }

    // Add token usage to response
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

    return res.status(200).json({
      ...parsed,
      tokensUsed: totalTokens,
      promptTokens,
      completionTokens,
      modelUsed: selectedModel
    });

  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Server error', 
      details: error?.message || 'Unknown error' 
    });
  }
}
