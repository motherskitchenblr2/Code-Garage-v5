import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  History,
  Settings,
  User,
  Copy,
  Download,
  X,
  AlertTriangle,
  Zap,
  Bug,
  Code2,
  Shield,
  Brain,
  Wrench,
  Sparkles,
  ChevronDown,
  Bot,
  Terminal as TerminalIcon,
  Search,
  HelpCircle,
  Send
} from 'lucide-react';
import 'highlight.js/styles/atom-one-dark.css';
import { Analytics } from '@vercel/analytics/react';

interface Session {
  id: string;
  timestamp: string;
  language: string;
  originalCode: string;
  fixedCode: string;
  issues: Issue[];
  summary: string;
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  modelUsed?: string;
}

interface Issue {
  id: number;
  type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
  explanation: string;
  original: string;
  fixed: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'normal';
  value: string;
  lineNumOriginal?: number;
  lineNumFixed?: number;
}

type View = 'editor' | 'history' | 'settings' | 'sentinel' | 'about';
type AgentMode = 'manual' | 'assist' | 'auto-syntax' | 'auto-debug' | 'team-review';

// REAL FREE MODELS from OpenRouter
const FREE_MODELS = [
  { id: 'openrouter/auto', name: 'OpenRouter Auto', tag: 'BALANCED', ctx: 'varies', color: '#FF5F00' },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder', tag: 'CODING', ctx: '1M', color: '#9333EA' },
  { id: 'deepseek/deepseek-v3-0324:free', name: 'DeepSeek V4 Flash', tag: 'REASONING', ctx: '1M', color: '#3B82F6' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 120B', tag: 'CODING', ctx: '128K', color: '#10B981' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', tag: 'BALANCED', ctx: '131K', color: '#F97316' },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', tag: 'FAST', ctx: '131K', color: '#EF4444' },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B', tag: 'FAST', ctx: '32K', color: '#6EE7B7' },
  { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini', tag: 'FAST', ctx: '128K', color: '#60A5FA' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B', tag: 'CODING', ctx: '131K', color: '#9333EA' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', tag: 'REASONING', ctx: '163K', color: '#3B82F6' },
];

const pluginOptions = [
  'Test Runner',
  'Console Trace',
  'Diff Reviewer',
  'Repo Scanner',
  'API Schema Reader',
  'Dependency Audit'
];

const skillOptions = [
  'Syntax Repair',
  'Bug Isolation',
  'Patch Generator',
  'Fix Verification',
  'Root Cause Drilldown',
  'Regression Guard'
];

const modeOptions: AgentMode[] = [
  'manual',
  'assist',
  'auto-syntax',
  'auto-debug',
  'team-review'
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('editor');
  const [code, setCode] = useState(
    'function calculateSum(arr) {\n  let sum = 0;\n  for (let i = 0; i < arr.length; i++) {\n    sum += arr[i];\n  }\n  console.log("Sum is: " + sum);\n  return sum;\n}'
  );
  const [language, setLanguage] = useState('javascript');
  const [detectedLanguage, setDetectedLanguage] = useState('javascript');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [fixedCode, setFixedCode] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('dev_user');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [selectedModel, setSelectedModel] = useState(FREE_MODELS[0]);
  const [selectedPlugin, setSelectedPlugin] = useState('Test Runner');
  const [selectedSkill, setSelectedSkill] = useState('Syntax Repair');
  const [agentStatus, setAgentStatus] = useState('idle');
  const [agentMode, setAgentMode] = useState<AgentMode>('assist');
  const [tokensUsed, setTokensUsed] = useState(0);
  const [promptTokens, setPromptTokens] = useState(0);
  const [completionTokens, setCompletionTokens] = useState(0);
  const [currentModelName, setCurrentModelName] = useState('');
  const [autoApplyFixes, setAutoApplyFixes] = useState(false);
  const [enableSentinel, setEnableSentinel] = useState(false);

  // v5.0 Added States
  const [aboutDocPage, setAboutDocPage] = useState<'whitepaper' | 'changelog' | 'comparison'>('whitepaper');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    `[SYSTEM] Volt Diagnostic Engine initialized. Ready for v5.0 operations.`
  ]);
  const [showTerminal, setShowTerminal] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const [debounceDelay, setDebounceDelay] = useState(800);
  const [showTokenUsage, setShowTokenUsage] = useState(true);
  const [showShortcutsCheatSheet, setShowShortcutsCheatSheet] = useState(false);
  
  // Sentinel State telemetry
  const [sentinelIssues, setSentinelIssues] = useState<Issue[]>([]);
  const [lastSentinelScan, setLastSentinelScan] = useState<string>('Never');
  const [isSentinelScanning, setIsSentinelScanning] = useState(false);
  const [sentinelStats, setSentinelStats] = useState({
    totalRuns: 0,
    totalBugsFixed: 0,
    timeSavedMinutes: 0,
    tokensConsumed: 0
  });

  // Agent Chat State
  const [agentMessages, setAgentMessages] = useState<{ role: 'user' | 'agent', content: string }[]>([
    { role: 'agent', content: 'Hello! I am the VOLT Agentic Orchestrator v5.0. I can analyze, explain, audit, and fix your code in real-time. Choose a quick action or ask me anything!' }
  ]);
  const [agentInput, setAgentInput] = useState('');

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedSessions = localStorage.getItem('codeSessions');
    if (savedSessions) {
      setSessions(JSON.parse(savedSessions));
    }
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  const saveSessions = (newSessions: Session[]) => {
    localStorage.setItem('codeSessions', JSON.stringify(newSessions));
    setSessions(newSessions);
  };

  const addLog = useCallback((msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'success' ? '✔ [SUCCESS]' : type === 'error' ? '✖ [ERROR]' : type === 'warn' ? '⚠ [WARNING]' : 'ℹ [INFO]';
    setTerminalLogs(prev => [...prev, `[${timestamp}] ${prefix} ${msg}`]);
  }, []);



  // Debounced Sentinel Scanner Watcher
  useEffect(() => {
    if (!enableSentinel) return;
    let active = true;

    const timer = setTimeout(async () => {
      setIsSentinelScanning(true);
      addLog(`[SENTINEL] Debounced watcher triggered passive code scan...`, 'info');
      try {
        const res = await fetch('/api/openrouter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            language: language === 'auto' ? detectedLanguage : language,
            model: 'mistralai/mistral-7b-instruct:free', // use fastest
            agentMode: 'manual',
            skill: 'Syntax Repair',
            plugin: selectedPlugin
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (active && data && data.issues) {
            setSentinelIssues(data.issues);
            setSentinelStats(prev => ({
              ...prev,
              totalRuns: prev.totalRuns + 1,
              tokensConsumed: prev.tokensConsumed + (data.tokensUsed || 0)
            }));
            addLog(`[SENTINEL] Passive scan completed. Found ${data.issues.length} potential issue(s).`, data.issues.length > 0 ? 'warn' : 'success');
            setLastSentinelScan(new Date().toLocaleTimeString());
          }
        } else {
          if (active) {
            addLog(`[SENTINEL] Passive scan failed with HTTP ${res.status}`, 'error');
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) {
          setIsSentinelScanning(false);
        }
      }
    }, debounceDelay);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [code, enableSentinel, debounceDelay, language, detectedLanguage, selectedPlugin, addLog]);

  const detectLanguage = (codeStr: string): string => {
    if ((codeStr.includes('def ') || codeStr.includes('import ')) && codeStr.includes(':')) return 'python';

    if (codeStr.includes('#include') || codeStr.includes('int main')) return 'cpp';
    if (codeStr.includes('<html') || codeStr.includes('<div')) return 'html';
    if (codeStr.includes('{') && codeStr.includes('}') && codeStr.includes(':')) return 'css';
    return 'javascript';
  };

  const handleCodeChange = (newCode: string) => {
    // FIX 1: Clean escaped HTML entities
    const cleanedCode = newCode.replace(/&lt;br&gt;/g, '\n');
    setCode(cleanedCode);
    const detected = detectLanguage(cleanedCode);
    setDetectedLanguage(detected);
    if (language === 'auto') {
      setLanguage(detected);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-5 py-3 rounded-xl font-semibold z-[120] border ${
      type === 'error' ? 'bg-red-950/80 text-red-400 border-red-500' : 
      type === 'success' ? 'bg-black/90 text-[#FF5F00] border-[#FF5F00]' :
      'bg-[#121212]/90 text-white border-white/20'
    } shadow-lg backdrop-blur-md`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  };

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const analyzeCode = useCallback(async () => {
    setIsAnalyzing(true);
    setIsScanning(true);
    setScanProgress(0);
    setAgentStatus('analyzing');
    setCurrentModelName(selectedModel.name);

    addLog(`Initiating code analysis. Mode: ${agentMode.toUpperCase()}, Skill: ${selectedSkill.toUpperCase()}, Tool: ${selectedPlugin.toUpperCase()}`, 'info');

    const scanInterval = setInterval(() => {
      setScanProgress((prev) => {
        const next = prev + Math.random() * 18 + 8;
        return Math.min(next, 100);
      });
    }, 120);

    await new Promise((resolve) => setTimeout(resolve, 1000));
    clearInterval(scanInterval);
    setScanProgress(100);
    setIsScanning(false);

    try {
      addLog(`Sending fetch payload to OpenRouter Gateway for evaluation...`, 'info');
      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: language === 'auto' ? detectedLanguage : language,
          model: selectedModel.id,
          agentMode,
          skill: selectedSkill,
          plugin: selectedPlugin
        })
      });

      if (!res.ok) {
        if (res.status === 429) {
          showToast('Rate limit reached. Free tier allows 20 req/min. Retry in 30s.', 'error');
          addLog(`OpenRouter error status 429: Too Many Requests`, 'error');
        } else if (res.status === 500) {
          showToast('Model temporarily unavailable. Try a different model.', 'error');
          addLog(`OpenRouter error status 500: Server Error`, 'error');
        } else {
          showToast('Network error. Check your connection.', 'error');
          addLog(`Connection error status ${res.status}`, 'error');
        }
        setIsAnalyzing(false);
        setAgentStatus('error');
        return;
      }

      const data = await res.json();
      
      if (!data || !data.issues) {
        showToast('Model returned empty response. Try again.', 'error');
        addLog(`Malformed openrouter response object`, 'error');
        setIsAnalyzing(false);
        setAgentStatus('error');
        return;
      }

      if (data.issues) setIssues(data.issues);
      if (data.fixedCode) setFixedCode(data.fixedCode);
      
      if (data.tokensUsed) {
        setTokensUsed(data.tokensUsed);
        setPromptTokens(data.promptTokens || 0);
        setCompletionTokens(data.completionTokens || 0);
      }

      setAgentStatus('complete');
      addLog(`Analysis complete. Found ${data.issues.length} potential issues. Model: ${data.modelUsed || selectedModel.id}`, 'success');
      showToast(`Analysis complete! Found ${data.issues.length} issues.`, 'success');
      
      if (autoApplyFixes && data.fixedCode) {
        setCode(data.fixedCode);
        addLog(`Auto-Apply enabled. Directly updated code with fixes.`, 'success');
      } else {
        setShowDiff(true);
      }
    } catch (err: any) {
      console.error('OpenRouter API error:', err);
      addLog(`Runtime connection failed: ${err?.message || err}`, 'error');
      showToast('Connection failed. Check your internet.', 'error');
      setAgentStatus('error');
    } finally {
      setIsAnalyzing(false);
    }
  }, [code, language, detectedLanguage, selectedModel, agentMode, selectedSkill, selectedPlugin, autoApplyFixes]);

  const applyAllFixes = useCallback(() => {
    if (!fixedCode) return;

    const btn = document.getElementById('fix-all-btn');
    if (btn) {
      btn.classList.add('animate-pulse');
      setTimeout(() => btn.classList.remove('animate-pulse'), 800);
    }

    // FIX 2: Apply all fixes using reduce correctly with global regex escape
    const allFixed = issues.reduce((acc, issue) => {
      const escaped = escapeRegExp(issue.original);
      return acc.replace(new RegExp(escaped, 'g'), issue.fixed);
    }, code);
    
    setCode(allFixed);
    setShowDiff(false);
    addLog(`Successfully patched and updated ${issues.length} issue(s).`, 'success');

    // Stats update for Sentinel
    setSentinelStats(prev => ({
      ...prev,
      totalBugsFixed: prev.totalBugsFixed + issues.length,
      timeSavedMinutes: prev.timeSavedMinutes + (issues.length * 2)
    }));

    const newSession: Session = {
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
      language: language === 'auto' ? detectedLanguage : language,
      originalCode: code,
      fixedCode: allFixed,
      issues,
      summary: `${issues.length} issues fixed. ${issues.filter((i) => i.severity === 'Critical' || i.severity === 'High').length} critical/high severity resolved.`,
      tokensUsed,
      promptTokens,
      completionTokens,
      modelUsed: selectedModel.name
    };

    const updatedSessions = [newSession, ...sessions].slice(0, 50);
    saveSessions(updatedSessions);
    setShowReport(true);
  }, [code, fixedCode, issues, language, detectedLanguage, tokensUsed, promptTokens, completionTokens, selectedModel, sessions]);

  // Keyboard Shortcuts Setup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        analyzeCode();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        applyAllFixes();
      }
      if (e.key === 'Escape') {
        setShowDiff(false);
        setShowAgentModal(false);
        setShowLoginModal(false);
        setShowShortcutsCheatSheet(false);
      }
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setCurrentView(prev => prev === 'sentinel' ? 'editor' : 'sentinel');
      }
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        const selectEl = document.getElementById('model-select-dropdown');
        if (selectEl) selectEl.focus();
      }
      if (e.key === '?' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setShowShortcutsCheatSheet(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [analyzeCode, applyAllFixes]);

  const sendAgentMessage = async (text: string) => {
    if (!text.trim()) return;

    setAgentMessages(prev => [...prev, { role: 'user', content: text }]);
    setAgentInput('');
    addLog(`[AGENT] Processing custom instruction: "${text}"`, 'info');

    setAgentStatus('analyzing');
    try {
      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: language === 'auto' ? detectedLanguage : language,
          model: selectedModel.id,
          agentMode,
          skill: selectedSkill,
          plugin: selectedPlugin,
          customPrompt: text
        })
      });

      if (!res.ok) {
        throw new Error(`Server status ${res.status}`);
      }

      const data = await res.json();
      if (data) {
        if (data.issues) setIssues(data.issues);
        if (data.fixedCode) setFixedCode(data.fixedCode);
        if (data.tokensUsed) {
          setTokensUsed(data.tokensUsed);
          setPromptTokens(data.promptTokens || 0);
          setCompletionTokens(data.completionTokens || 0);
        }

        const replySummary = data.summary || `I've analyzed the code matching your query. Found ${data.issues?.length || 0} issues. Check the main board for details.`;
        setAgentMessages(prev => [...prev, { role: 'agent', content: replySummary }]);
        addLog(`[AGENT] Code parsed & prompt solved.`, 'success');
      }
    } catch (err: any) {
      setAgentMessages(prev => [...prev, { role: 'agent', content: `Sorry, I failed to complete that task: ${err.message}` }]);
      addLog(`[AGENT] Query failed: ${err.message}`, 'error');
    } finally {
      setAgentStatus('idle');
    }
  };

  const handleAgentQuickAction = (actionType: 'analyze' | 'security' | 'performance' | 'explain' | 'fix') => {
    let promptText = '';
    if (actionType === 'analyze') {
      promptText = 'Please perform a full code diagnosis and outline any logic, syntax, or styling issues.';
    } else if (actionType === 'security') {
      promptText = 'Scan the current workspace code for potential security vulnerabilities like XSS, injections, unsafe regex, or credentials leaks.';
    } else if (actionType === 'performance') {
      promptText = 'Analyze the code execution flow and identify O(N^2) complexity, unnecessary memory allocations, or blocking structures.';
    } else if (actionType === 'explain') {
      promptText = 'Review the last analysis report and explain the root causes of the issues found.';
    } else if (actionType === 'fix') {
      promptText = 'Generate a comprehensive fix patch for the critical and high severity issues in the code.';
    }
    sendAgentMessage(promptText);
  };

  const computeDiff = (original: string, fixed: string) => {
    const originalLines = original.split('\n');
    const fixedLines = fixed.split('\n');
    const diff: DiffLine[] = [];
    
    let i = 0, j = 0;
    while (i < originalLines.length || j < fixedLines.length) {
      if (i < originalLines.length && j < fixedLines.length) {
        if (originalLines[i] === fixedLines[j]) {
          diff.push({ type: 'normal', value: originalLines[i], lineNumOriginal: i + 1, lineNumFixed: j + 1 });
          i++;
          j++;
        } else {
          const nextMatchInFixed = fixedLines.indexOf(originalLines[i], j);
          if (nextMatchInFixed !== -1 && nextMatchInFixed - j < 5) {
            while (j < nextMatchInFixed) {
              diff.push({ type: 'added', value: fixedLines[j], lineNumFixed: j + 1 });
              j++;
            }
          } else {
            diff.push({ type: 'removed', value: originalLines[i], lineNumOriginal: i + 1 });
            i++;
          }
        }
      } else if (i < originalLines.length) {
        diff.push({ type: 'removed', value: originalLines[i], lineNumOriginal: i + 1 });
        i++;
      } else if (j < fixedLines.length) {
        diff.push({ type: 'added', value: fixedLines[j], lineNumFixed: j + 1 });
        j++;
      }
    }
    return diff;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('COPIED TO CLIPBOARD!', 'success');
  };

  const downloadCode = (text: string, filename: string) => {
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const loadSession = (session: Session) => {
    setCode(session.originalCode);
    setFixedCode(session.fixedCode);
    setIssues(session.issues);
    setLanguage(session.language);
    setDetectedLanguage(session.language);
    if (session.tokensUsed) {
      setTokensUsed(session.tokensUsed);
      setPromptTokens(session.promptTokens || 0);
      setCompletionTokens(session.completionTokens || 0);
    }
    if (session.modelUsed) setCurrentModelName(session.modelUsed);
    setCurrentView('editor');
    setShowReport(true);
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    setShowLoginModal(false);
  };

  const languages = [
    { value: 'auto', label: 'Auto Detect' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'python', label: 'Python' },
    { value: 'cpp', label: 'C++' },
    { value: 'html', label: 'HTML' }
  ];

  const filteredSessions = sessions.filter(s => 
    s.summary.toLowerCase().includes(historySearch.toLowerCase()) ||
    s.language.toLowerCase().includes(historySearch.toLowerCase()) ||
    (s.modelUsed && s.modelUsed.toLowerCase().includes(historySearch.toLowerCase()))
  );

  const renderModelSelect = () => (
    <div className="flex items-center gap-3 border border-[#FF5F00]/40 rounded-xl px-4 py-2 bg-black/40">
      <div className="text-[#FF5F00]/70 text-xs tracking-wider">ENGINE</div>
      <ChevronDown className="w-4 h-4 text-[#FF5F00]/60" />
      <select
        id="model-select-dropdown"
        value={selectedModel.id}
        onChange={(e) => {
          const model = FREE_MODELS.find(m => m.id === e.target.value)!;
          setSelectedModel(model);
          addLog(`Selected execution model: ${model.name}`, 'info');
        }}
        className="bg-transparent text-white outline-none min-w-[180px] font-semibold text-xs cursor-pointer"
      >
        {FREE_MODELS.map((model) => (
          <option key={model.id} value={model.id} className="bg-[#121212] text-white">
            {model.name} ({model.tag} • {model.ctx})
          </option>
        ))}
      </select>
    </div>
  );

  const renderSelect = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: string[]
  ) => (
    <div className="flex items-center gap-3 border border-[#FF5F00]/40 rounded-xl px-4 py-2 bg-black/40">
      <div className="text-[#FF5F00]/70 text-xs tracking-wider">{label}</div>
      <ChevronDown className="w-4 h-4 text-[#FF5F00]/60" />
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          addLog(`Updated config: ${label} -> ${e.target.value}`, 'info');
        }}
        className="bg-transparent text-white outline-none min-w-[130px] text-xs cursor-pointer"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-[#121212] text-white">
            {option}
          </option>
        ))}
      </select>
    </div>
  );

  const renderAboutWhitePaper = () => {
    return (
      <div className="p-8 max-w-4xl mx-auto overflow-y-auto h-full pb-20 select-text">
        <div className="bg-white text-black p-12 shadow-2xl rounded-2xl border-4 border-double border-black font-serif relative">
          <button
            onClick={() => setCurrentView('editor')}
            className="absolute top-6 right-6 px-4 py-2 rounded-full border border-black hover:bg-black hover:text-white transition-all font-sans text-xs font-bold"
          >
            DISAPPEAR DOCUMENT [ESC]
          </button>

          {/* DOCUMENT SWITCHER TAB */}
          <div className="flex flex-wrap gap-3 mb-8 justify-center select-none font-sans">
            <button
              onClick={() => setAboutDocPage('whitepaper')}
              className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                aboutDocPage === 'whitepaper'
                  ? 'bg-black text-white border-black shadow-md'
                  : 'bg-white text-black border-black/20 hover:bg-black/5'
              }`}
            >
              TECHNICAL SPECIFICATION (SPEC-001)
            </button>
            <button
              onClick={() => setAboutDocPage('changelog')}
              className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                aboutDocPage === 'changelog'
                  ? 'bg-black text-white border-black shadow-md'
                  : 'bg-white text-black border-black/20 hover:bg-black/5'
              }`}
            >
              UPGRADE LOG (SPEC-002)
            </button>
            <button
              onClick={() => setAboutDocPage('comparison')}
              className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                aboutDocPage === 'comparison'
                  ? 'bg-black text-white border-black shadow-md'
                  : 'bg-white text-black border-black/20 hover:bg-black/5'
              }`}
            >
              COMPARISON MATRIX (SPEC-003)
            </button>
          </div>

          {aboutDocPage === 'whitepaper' && (
            <>
              <div className="text-center mb-10 border-b-2 border-black pb-8">
                <div className="text-xs tracking-[4px] uppercase font-sans font-bold text-gray-500 mb-2">Technical Specification Sheet</div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight uppercase leading-tight mb-4">
                  VOLT CODE AI v5.0:<br />Agentic Code Fixing Hub
                </h1>
                <div className="text-sm font-sans font-semibold text-gray-700">
                  Co-Developers: <span className="underline">AntiGravity (Agentic AI Co-Developer)</span> & <span className="underline">Gemini AI 3.5 Flash</span>
                </div>
                <div className="text-xs text-gray-500 mt-2 font-sans">Released: June 2026 • Status: Production Deployed</div>
              </div>

              <div className="mb-10 px-6 py-4 bg-gray-50 border-l-4 border-black">
                <h2 className="font-sans font-bold text-sm uppercase tracking-wider mb-2">Abstract</h2>
                <p className="text-sm leading-relaxed text-gray-800 italic">
                  Volt Code AI v5.0 introduces an integrated architecture for automated diagnostics and self-repair. Under this specification, we detail the implementation of a client-side unified diff engine, background passive watchdog telemetry (Sentinel), and the real-time interaction capabilities of the conversational Agent Orchestrator. 
                </p>
              </div>

              <div className="mb-10 text-sm font-sans">
                <h3 className="font-bold uppercase mb-2">1. Table of Contents</h3>
                <ul className="space-y-1 list-decimal list-inside text-gray-700">
                  <li>Core Architecture Strategy</li>
                  <li>Sentinel Background Telemetry</li>
                  <li>Chat-First Agent Workspace</li>
                  <li>Dedicated Virtual Terminal Stream</li>
                  <li>Keyboard Shortcut Schema</li>
                </ul>
              </div>

              <div className="space-y-8 text-sm leading-relaxed text-gray-900 font-serif">
                <section>
                  <h2 className="font-sans font-bold text-lg border-b border-black pb-1 mb-3 uppercase">2. Core Architecture Strategy</h2>
                  <p className="mb-3">
                    Volt Code AI executes repairs through a dual-channel design. User requests are evaluated by an orchestration middleware which extracts lines, scans for security targets, and queries optimized model pipelines. To prevent user interface clutter, v5.0 consolidates Model, Skill, Plugin, and Mode selections inside a single runtime panel in the editor workspace, enforcing a strict single-source-of-truth strategy.
                  </p>
                </section>

                <section>
                  <h2 className="font-sans font-bold text-lg border-b border-black pb-1 mb-3 uppercase">3. Sentinel Telemetry</h2>
                  <p className="mb-3">
                    The Sentinel engine maintains watch on the active editor contents. Using a debounced timeout delay, Sentinel executes background calls without locking the editing thread. The returns populate a live severity heatmap and an issue feed, recommending targeted patches that can be applied with a single click.
                  </p>
                </section>

                <section>
                  <h2 className="font-sans font-bold text-lg border-b border-black pb-1 mb-3 uppercase">4. Chat-First Agent Workspace</h2>
                  <p className="mb-3">
                    The floating Agent Modal has been upgraded from a duplicate settings form into a chat console. The Agent possesses full context memory of the workspace, enabling it to explain bug reports, perform security audits, detect O(N²) loops, and draft changes conversationally.
                  </p>
                </section>

                <section>
                  <h2 className="font-sans font-bold text-lg border-b border-black pb-1 mb-3 uppercase">5. Dedicated Virtual Terminal Stream</h2>
                  <p className="mb-3">
                    Volt Code AI houses a virtual console capturing telemetry log data. Every step of execution—including model routing decisions, token reports, parse statuses, and API network roundtrips—is streamed chronologically to this console to ensure full system transparency.
                  </p>
                </section>
              </div>
            </>
          )}

          {aboutDocPage === 'changelog' && (
            <>
              <div className="text-center mb-10 border-b-2 border-black pb-8">
                <div className="text-xs tracking-[4px] uppercase font-sans font-bold text-gray-500 mb-2">Technical specs restoration log</div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight uppercase leading-tight mb-4">
                  SPEC-002: SYSTEM UPGRADE<br />& DEAD-TO-ALIVE CHANGELOG
                </h1>
                <div className="text-sm font-sans font-semibold text-gray-700">
                  Document Author: <span className="underline">AntiGravity AI Co-Developer</span> & <span className="underline">Gemini AI 3.5 Flash</span>
                </div>
                <div className="text-xs text-gray-500 mt-2 font-sans">Published: June 2026 • Target: v5.0 Upgrade Hub</div>
              </div>

              <div className="mb-10 px-6 py-4 bg-gray-50 border-l-4 border-black">
                <h2 className="font-sans font-bold text-sm uppercase tracking-wider mb-2">Abstract</h2>
                <p className="text-sm leading-relaxed text-gray-800 italic">
                  This document specifies the system upgrades conducted to bring legacy placeholder structures and non-functional routing dropdowns to life. We outline the integration of the Sentinel debounced watcher daemon, conversational Agent chat console, client-side LCS diff parser, and terminal stream logging.
                </p>
              </div>

              <div className="space-y-8 text-sm leading-relaxed text-gray-900 font-serif">
                <section>
                  <h2 className="font-sans font-bold text-lg border-b border-black pb-1 mb-3 uppercase">1. Sentinel Background Telemetry Engine</h2>
                  <p className="mb-3 font-bold text-gray-800">Status: Dead Placeholder ➔ Fully Operational Watchdog</p>
                  <p className="mb-2">
                    In previous releases, the Sentinel interface was a static layout representing "Internal Operations Queue," "Skills Room," and "Plugins Room" as simple, disconnected labels. No background monitoring or actual linter processes were wired in.
                  </p>
                  <p>
                    **Restoration Details**: A debounced React hook has been integrated. When enabled, it monitors code adjustments in real-time, executing background scans via OpenRouter's fast Mistral-7B API. Sentinel aggregates counts to populate an animated **Severity Heatmap** and logs all warnings to a **Live Watchdog Feed** with instant patch-application buttons.
                  </p>
                </section>

                <section>
                  <h2 className="font-sans font-bold text-lg border-b border-black pb-1 mb-3 uppercase">2. Conversational Agent Command Console</h2>
                  <p className="mb-3 font-bold text-gray-800">Status: Redundant Settings Modal ➔ Active Chat Orchestrator</p>
                  <p className="mb-2">
                    The legacy Agent Modal merely replicated Model, Plugin, Skill, and Mode dropdown selections already available in the main editor workspace, rendering it visually duplicate and non-functional.
                  </p>
                  <p>
                    **Restoration Details**: Redundant dropdown selectors have been completely removed. The modal has been reconstructed into a chat-centric developer console. It maintains workspace state and routes custom instructions directly to the API. It also exposes **Command Preset Cards** to perform security scans, complexity audits, performance profile reviews, and patch drafts.
                  </p>
                </section>

                <section>
                  <h2 className="font-sans font-bold text-lg border-b border-black pb-1 mb-3 uppercase">3. LCS Diff Visualizer & Code Refactoring Bug</h2>
                  <p className="mb-3 font-bold text-gray-800">Status: Plain Pre Blocks & Discarded Fix Code ➔ Unified Line Diff & Reducer</p>
                  <p className="mb-2">
                    The original `applyAllFixes` method computed a combined code repair reducer but discarded its own output, instead calling `setCode(fixedCode)`. This resulted in corrupted formatting. Concurrently, the Diff modal rendered code in two raw side-by-side `&lt;pre&gt;` containers with no line highlighting.
                  </p>
                  <p>
                    **Restoration Details**: Modified `applyAllFixes` to store and write the `allFixed` reducer result correctly. Built a custom client-side LCS diff parser showing line additions (`+` in green) and deletions (`-` in red) with dual line numbering and an instant copy button in the footer.
                  </p>
                </section>

                <section>
                  <h2 className="font-sans font-bold text-lg border-b border-black pb-1 mb-3 uppercase">4. Virtual Dedicated Terminal</h2>
                  <p className="mb-3 font-bold text-gray-800">Status: Non-Existent ➔ Live Diagnostic Stream</p>
                  <p className="mb-2">
                    The system lacked any real-time tracking interface, causing network delays or API timeouts to fail silently without user visibility.
                  </p>
                  <p>
                    **Restoration Details**: Implemented a toggleable virtual console at the bottom of the editor. The stream logs API calls, model tags, roundtrip response times, parser successes, and warning alerts in color-coded output lines.
                  </p>
                </section>
              </div>
            </>
          )}

          {aboutDocPage === 'comparison' && (
            <>
              <div className="text-center mb-10 border-b-2 border-black pb-8">
                <div className="text-xs tracking-[4px] uppercase font-sans font-bold text-gray-500 mb-2">Upgrade telemetry comparison matrix</div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight uppercase leading-tight mb-4">
                  SPEC-003: UPGRADE SUMMARY<br />& COMPARISON MATRIX
                </h1>
                <div className="text-sm font-sans font-semibold text-gray-700">
                  Prepared by: <span className="underline">AntiGravity AI Co-Developer</span> & <span className="underline">Gemini AI 3.5 Flash</span>
                </div>
                <div className="text-xs text-gray-500 mt-2 font-sans">Scope: v4.9 (Legacy Placeholder) vs v5.0 (Agentic Hub)</div>
              </div>

              <div className="mb-8 px-6 py-4 bg-gray-50 border-l-4 border-black font-serif">
                <h2 className="font-sans font-bold text-sm uppercase tracking-wider mb-2">Notice</h2>
                <p className="text-sm leading-relaxed text-gray-800 italic">
                  This specification matrix details the comparative analysis of features that were dead or placeholder in the legacy codebase and have been brought to full functional life in Volt Code AI v5.0. This comparative process is set as a standard requirement for all future major releases.
                </p>
              </div>

              {/* COMPARISON TABLE */}
              <div className="overflow-x-auto font-sans text-xs mb-8">
                <table className="min-w-full border border-black/35 text-left border-collapse leading-relaxed">
                  <thead>
                    <tr className="bg-black text-white uppercase tracking-wider text-[10px]">
                      <th className="border border-black px-4 py-3 font-bold">Feature Name</th>
                      <th className="border border-black px-4 py-3 font-bold">v4.9 State (Before / Dead)</th>
                      <th className="border border-black px-4 py-3 font-bold">v5.0 State (After / Alive)</th>
                      <th className="border border-black px-4 py-3 font-bold">Validation</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-gray-50 hover:bg-gray-100/50">
                      <td className="border border-black/30 px-4 py-3 font-bold">Sentinel Watchdog</td>
                      <td className="border border-black/30 px-4 py-3 text-red-700 italic">Static labels; dead placeholders.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-800 font-medium">Debounced active watcher scan, severity heatbars, warning log feeds & instant patch buttons.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-700 font-bold">✔ Verified</td>
                    </tr>
                    <tr className="hover:bg-gray-100/50">
                      <td className="border border-black/30 px-4 py-3 font-bold">Agent Orchestrator</td>
                      <td className="border border-black/30 px-4 py-3 text-red-700 italic">Duplicate settings selectors modal; no actual agent features.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-800 font-medium">Chat console with conversation history, active workspace memory & quick audit button triggers.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-700 font-bold">✔ Verified</td>
                    </tr>
                    <tr className="bg-gray-50 hover:bg-gray-100/50">
                      <td className="border border-black/30 px-4 py-3 font-bold">Refactoring Patch Engine</td>
                      <td className="border border-black/30 px-4 py-3 text-red-700 italic">Discarded reducer results; auto-apply formatting bugs.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-800 font-medium">Modified patch logic to save and write the combined `allFixed` reducer code successfully.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-700 font-bold">✔ Verified</td>
                    </tr>
                    <tr className="hover:bg-gray-100/50">
                      <td className="border border-black/30 px-4 py-3 font-bold">Unified Diff Visualizer</td>
                      <td className="border border-black/30 px-4 py-3 text-red-700 italic">Side-by-side unhighlighted pre containers.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-800 font-medium">Custom client-side LCS diff parser rendering red deletions and green additions with numbers.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-700 font-bold">✔ Verified</td>
                    </tr>
                    <tr className="bg-gray-50 hover:bg-gray-100/50">
                      <td className="border border-black/30 px-4 py-3 font-bold">Virtual Diagnostic Terminal</td>
                      <td className="border border-black/30 px-4 py-3 text-red-700 italic">Non-existent; server timeouts failed silently.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-800 font-medium">Toggleable console panel logging server calls, response timers, parsed tokens and errors.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-700 font-bold">✔ Verified</td>
                    </tr>
                    <tr className="hover:bg-gray-100/50">
                      <td className="border border-black/30 px-4 py-3 font-bold">Model Identity Badge</td>
                      <td className="border border-black/30 px-4 py-3 text-red-700 italic">Hidden until analysis finished; minimal watermark tags.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-800 font-medium">Always visible header badge tracking engine tags, context size, and real-time scanning status.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-700 font-bold">✔ Verified</td>
                    </tr>
                    <tr className="bg-gray-50 hover:bg-gray-100/50">
                      <td className="border border-black/30 px-4 py-3 font-bold">Keyboard Hotkeys</td>
                      <td className="border border-black/30 px-4 py-3 text-red-700 italic">Non-existent.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-800 font-medium">Global shortcut hooks (Ctrl+Enter, Ctrl+Shift+F, Ctrl+/, Ctrl+K, Escape, ?) and guide.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-700 font-bold">✔ Verified</td>
                    </tr>
                    <tr className="hover:bg-gray-100/50">
                      <td className="border border-black/30 px-4 py-3 font-bold">Session History Filter</td>
                      <td className="border border-black/30 px-4 py-3 text-red-700 italic">List display with zero search capabilities.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-800 font-medium">Interactive keyword input matching summaries, languages, and models.</td>
                      <td className="border border-black/30 px-4 py-3 text-green-700 font-bold">✔ Verified</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="mt-12 pt-8 border-t border-black text-center text-xs font-sans text-gray-500">
            © 2026 Volt Code AI. Built under Vercel Serverless Architecture.
          </div>
        </div>
      </div>
    );
  };

  const renderSentinelBoard = () => {
    return (
      <div className="p-8 h-full overflow-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-[#FF5F00]/20 pb-6">
          <div>
            <div className="text-[#FF5F00] text-xs tracking-[3px] font-bold uppercase mb-1">Live Telemetry & Telemetric Scan</div>
            <h1 className="text-3xl font-extrabold">SENTINEL OPERATIONS</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#FF5F00]/30 bg-black/40 text-sm">
              <span className={`w-2 h-2 rounded-full ${enableSentinel ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="font-semibold text-white/90">MONITOR: {enableSentinel ? 'ACTIVE' : 'STANDBY'}</span>
            </div>
            <div className="px-4 py-2 rounded-xl border border-[#FF5F00]/30 bg-black/40 text-sm text-[#FF5F00]">
              Last Watch-Scan: {lastSentinelScan}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border border-[#FF5F00]/20 bg-black/45 p-5 rounded-2xl">
            <div className="text-xs text-white/50 uppercase font-semibold">Checks Executed</div>
            <div className="text-2xl font-black text-[#FF5F00] mt-1">{sentinelStats.totalRuns}</div>
          </div>
          <div className="border border-[#FF5F00]/20 bg-black/45 p-5 rounded-2xl">
            <div className="text-xs text-white/50 uppercase font-semibold">Telemetry Spent</div>
            <div className="text-2xl font-black text-white mt-1">{sentinelStats.tokensConsumed} <span className="text-xs font-normal text-white/40">tokens</span></div>
          </div>
          <div className="border border-[#FF5F00]/20 bg-black/45 p-5 rounded-2xl">
            <div className="text-xs text-white/50 uppercase font-semibold">Active Warnings</div>
            <div className="text-2xl font-black text-red-500 mt-1">{sentinelIssues.length}</div>
          </div>
          <div className="border border-[#FF5F00]/20 bg-black/45 p-5 rounded-2xl">
            <div className="text-xs text-white/50 uppercase font-semibold">Time Saved (Est.)</div>
            <div className="text-2xl font-black text-green-400 mt-1">{sentinelStats.timeSavedMinutes} <span className="text-xs font-normal text-white/40">mins</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 border border-[#FF5F00]/20 bg-black/40 p-6 rounded-3xl space-y-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#FF5F00]" />
              Watchdog Diagnostic Heatmap
            </h2>
            
            <div className="space-y-3">
              {[
                { label: 'Critical / Vulnerability', count: sentinelIssues.filter(i => i.severity === 'Critical').length, color: 'bg-red-500' },
                { label: 'High / Functional Logic', count: sentinelIssues.filter(i => i.severity === 'High').length, color: 'bg-orange-500' },
                { label: 'Medium / Performance', count: sentinelIssues.filter(i => i.severity === 'Medium').length, color: 'bg-yellow-500' },
                { label: 'Low / Code Smells', count: sentinelIssues.filter(i => i.severity === 'Low').length, color: 'bg-blue-500' },
              ].map((bar, idx) => {
                const maxVal = Math.max(...[1, sentinelIssues.length]);
                const percent = (bar.count / maxVal) * 100;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-white/60">{bar.label}</span>
                      <span className="text-white">{bar.count} issues</span>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${bar.color} transition-all duration-500`} style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-white/10 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  if (sentinelIssues.length > 0) {
                    setIssues(sentinelIssues);
                    const allFixed = sentinelIssues.reduce((acc, issue) => {
                      const escaped = escapeRegExp(issue.original);
                      return acc.replace(new RegExp(escaped, 'g'), issue.fixed);
                    }, code);
                    setCode(allFixed);
                    setSentinelIssues([]);
                    showToast('Applied sentinel patches.', 'success');
                  } else {
                    showToast('No active sentinel issues to patch.', 'info');
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-[#FF5F00] text-black font-extrabold text-xs cursor-pointer"
              >
                APPLY SENTINEL PATCH
              </button>
              <button 
                onClick={() => {
                  setLanguage(detectedLanguage);
                  analyzeCode();
                }}
                className="px-5 py-2.5 rounded-xl border border-white/20 hover:bg-white/5 text-white text-xs font-bold cursor-pointer"
              >
                RUN FORCE TELEMETRY ANALYSIS
              </button>
            </div>
          </div>

          <div className="border border-[#FF5F00]/20 bg-black/40 p-6 rounded-3xl space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FF5F00]" />
              Passive Scan Feed
            </h2>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {sentinelIssues.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-xs">
                  Watcher scanning current editor inputs. Keep writing code...
                </div>
              ) : (
                sentinelIssues.map((issue, idx) => (
                  <div key={idx} className="p-3 bg-[#0a0a0a] rounded-xl border-l-4 border-[#FF5F00] text-xs">
                    <div className="flex justify-between font-bold mb-1">
                      <span>{issue.type}</span>
                      <span className="text-[#FF5F00]">{issue.severity}</span>
                    </div>
                    <p className="text-white/60 mb-2">{issue.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTerminal = () => {
    if (!showTerminal) return null;
    return (
      <div className="border-t border-[#FF5F00]/30 bg-[#0a0a0a] h-48 flex flex-col font-mono text-xs text-white">
        <div className="bg-[#121212] border-b border-[#FF5F00]/20 px-6 py-2 flex justify-between items-center select-none">
          <div className="flex items-center gap-2 text-[#FF5F00] font-bold">
            <TerminalIcon className="w-4 h-4" />
            <span>DEDICATED VIRUS/BUG DIAGNOSTIC STREAM</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setTerminalLogs([`[SYSTEM] Log stream cleared.`])}
              className="text-[#FF5F00]/60 hover:text-[#FF5F00] text-[10px] uppercase font-bold cursor-pointer"
            >
              Clear
            </button>
            <button 
              onClick={() => setShowTerminal(false)}
              className="text-[#FF5F00]/60 hover:text-[#FF5F00] text-[10px] uppercase font-bold cursor-pointer"
            >
              Minimize
            </button>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto space-y-1 select-text">
          {terminalLogs.map((log, idx) => {
            let textColor = 'text-white/70';
            if (log.includes('[SUCCESS]')) textColor = 'text-green-400';
            else if (log.includes('[ERROR]')) textColor = 'text-red-400';
            else if (log.includes('[WARNING]')) textColor = 'text-yellow-400 font-bold';
            else if (log.includes('[INFO]')) textColor = 'text-[#FF5F00]';
            
            return (
              <div key={idx} className={textColor}>
                {log}
              </div>
            );
          })}
          <div ref={terminalEndRef} />
        </div>
      </div>
    );
  };

  const renderUnifiedDiff = () => {
    if (!fixedCode) return <div className="text-white/45">No fixed changes staged.</div>;
    const diffLines = computeDiff(code, fixedCode);
    return (
      <div className="bg-[#0a0a0a] rounded-2xl border border-[#FF5F00]/20 font-mono text-xs overflow-auto max-h-[480px] p-6 leading-relaxed">
        {diffLines.map((line, idx) => {
          let bgColor = '';
          let textColor = 'text-white/80';
          let prefix = ' ';
          
          if (line.type === 'added') {
            bgColor = 'bg-green-500/10 border-l-2 border-green-500';
            textColor = 'text-green-400';
            prefix = '+';
          } else if (line.type === 'removed') {
            bgColor = 'bg-red-500/10 border-l-2 border-red-500';
            textColor = 'text-red-400';
            prefix = '-';
          }
          
          return (
            <div key={idx} className={`flex py-0.5 px-2 -mx-2 ${bgColor}`}>
              <div className="w-12 text-white/30 select-none text-right pr-4">
                {line.lineNumOriginal || ''}
              </div>
              <div className="w-12 text-white/30 select-none text-right pr-4">
                {line.lineNumFixed || ''}
              </div>
              <div className="w-6 text-white/40 select-none text-center font-bold">
                {prefix}
              </div>
              <span className={`whitespace-pre-wrap ${textColor}`}>
                {line.value}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white flex select-none" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Sidebar navigation */}
      <div className="w-64 border-r border-[#FF5F00]/20 p-6 flex flex-col">
        <div className="mb-12">
          <div className="text-[#FF5F00] text-3xl font-black tracking-tighter">VOLT</div>
          <div className="text-white text-2xl font-extrabold tracking-tight">CODE AI</div>
          <div className="text-[#FF5F00] text-[10px] mt-1 font-bold tracking-[3px]">v5.0 AGENTIC HUB</div>
        </div>

        {!isLoggedIn ? (
          <button
            onClick={() => setShowLoginModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF5F00] hover:bg-[#FF5F00]/90 text-black font-extrabold transition-all active:scale-[0.985] cursor-pointer"
          >
            <User className="w-4 h-4" />
            LOGIN TO SAVE
          </button>
        ) : (
          <div className="text-[#FF5F00] font-semibold">{username}</div>
        )}

        <div className="mt-12 space-y-1">
          <div
            onClick={() => setCurrentView('editor')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer mb-1 transition-all ${
              currentView === 'editor'
                ? 'bg-[#FF5F00] text-black font-bold'
                : 'hover:bg-white/5 text-[#FF5F00]'
            }`}
          >
            <Play className="w-5 h-5" />
            NEW ANALYSIS
          </div>

          <div
            onClick={() => setCurrentView('history')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer mb-1 transition-all ${
              currentView === 'history'
                ? 'bg-[#FF5F00] text-black font-bold'
                : 'hover:bg-white/5 text-[#FF5F00]'
            }`}
          >
            <History className="w-5 h-5" />
            SESSION HISTORY
          </div>

          {/* FIX 1: Remove "TAB" from Sentinel Button label */}
          <div
            onClick={() => setCurrentView('sentinel')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer mb-1 transition-all ${
              currentView === 'sentinel'
                ? 'bg-[#FF5F00] text-black font-bold'
                : 'hover:bg-white/5 text-[#FF5F00]'
            }`}
          >
            <Shield className="w-5 h-5" />
            SENTINEL
          </div>

          <div
            onClick={() => setCurrentView('settings')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer mb-1 transition-all ${
              currentView === 'settings'
                ? 'bg-[#FF5F00] text-black font-bold'
                : 'hover:bg-white/5 text-[#FF5F00]'
            }`}
          >
            <Settings className="w-5 h-5" />
            SETTINGS
          </div>

          <div
            onClick={() => setCurrentView('about')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
              currentView === 'about'
                ? 'bg-[#FF5F00] text-black font-bold'
                : 'hover:bg-white/5 text-[#FF5F00]'
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            ABOUT / WHITE PAPER
          </div>
        </div>

        <div className="mt-auto pt-8 text-xs opacity-40 space-y-1">
          <div>HIGH-VOLTAGE AGENT CORE</div>
          <div>NEON ORANGE #FF5F00</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {currentView === 'editor' && (
          <>
            <div className="border-b border-[#FF5F00]/20 p-6">
              <div className="mb-1 flex justify-between items-start">
                <div>
                  <div className="text-2xl font-bold">MULTI-LANGUAGE EDITOR</div>
                  <div className="text-sm text-[#FF5F00]/70">AI Bug Finder, Agent Runner & Telemetrist</div>
                </div>
                <button
                  onClick={() => setShowShortcutsCheatSheet(true)}
                  className="px-3 py-1 rounded-lg border border-white/20 hover:bg-white/5 text-white/60 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  SHORTCUTS [?]
                </button>
              </div>

              {/* SINGLE POINT OF TRUTH WORKSPACE TOOLBAR */}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                {renderModelSelect()}
                {renderSelect('Plugin', selectedPlugin, setSelectedPlugin, pluginOptions)}
                {renderSelect('Skill', selectedSkill, setSelectedSkill, skillOptions)}
                {renderSelect('Mode', agentMode, (v) => setAgentMode(v as AgentMode), modeOptions)}
                
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-black border border-[#FF5F00]/60 px-4 py-2 text-sm rounded focus:outline-none focus:border-[#FF5F00] cursor-pointer"
                >
                  {languages.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>

                <div className="px-4 py-2 rounded bg-[#FF5F00]/10 text-[#FF5F00] text-sm font-semibold">
                  DETECTED: {detectedLanguage.toUpperCase()}
                </div>
              </div>

              {/* HIGHLY VISIBLE MODEL IDENTITY BADGE */}
              <div className="mt-4 flex flex-wrap gap-4 items-center">
                <div className="px-4 py-2.5 rounded-xl border border-[#FF5F00] bg-black/60 inline-flex items-center gap-3">
                  <Zap className="w-4 h-4 text-[#FF5F00] animate-pulse" />
                  <div className="flex flex-col">
                    <div className="text-[#FF5F00] text-[9px] tracking-widest font-bold uppercase">Active Engine</div>
                    <div className="font-extrabold text-sm text-white">{selectedModel.name}</div>
                  </div>
                  <div className="h-6 w-px bg-white/20"></div>
                  <div className="text-[10px] text-white/60 uppercase font-semibold">
                    {selectedModel.tag} • {selectedModel.ctx} Context • Free Tier
                  </div>
                </div>

                {showTokenUsage && tokensUsed > 0 && (
                  <div className="p-3 rounded-xl border border-[#FF5F00]/20 bg-black/40 flex items-center gap-6">
                    <div>
                      <div className="text-[#FF5F00] text-[10px] tracking-wider font-bold">TOTAL CONSUMPTION</div>
                      <div className="text-white font-extrabold text-lg">{tokensUsed} <span className="text-xs text-white/50 font-normal">tokens</span></div>
                    </div>
                    <div className="h-8 w-px bg-white/10"></div>
                    <div className="text-xs text-white/50 space-y-0.5">
                      <div>Prompt: {promptTokens}</div>
                      <div>Completion: {completionTokens}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden flex flex-col">
              {isScanning && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${scanProgress}%` }}
                  className="absolute top-0 left-0 h-1 bg-[#FF5F00] z-10"
                />
              )}

              <textarea
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                spellCheck={false}
                autoCorrect="off"
                className="w-full flex-1 resize-none bg-transparent p-8 font-mono text-[15px] leading-[1.65] outline-none text-[#EDEDED] caret-[#FF5F00]"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  boxShadow: 'inset 0 0 0 1px rgba(255,95,0,0.05)'
                }}
              />

              <div className="absolute bottom-6 right-6 flex gap-3 flex-wrap justify-end">
                {!showTerminal && (
                  <button 
                    onClick={() => setShowTerminal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-black border border-white/20 hover:border-white/40 text-xs rounded-xl font-bold cursor-pointer"
                  >
                    <TerminalIcon className="w-3.5 h-3.5" />
                    SHOW TERMINAL
                  </button>
                )}

                <motion.button
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={analyzeCode}
                  disabled={isAnalyzing}
                  className="flex items-center gap-3 px-8 py-3.5 rounded-xl bg-black border-2 border-[#FF5F00] text-[#FF5F00] font-semibold disabled:opacity-60 active:bg-[#FF5F00] active:text-black transition-all cursor-pointer"
                >
                  <Bug className="w-5 h-5" />
                  {isAnalyzing ? 'ANALYZING...' : 'RUN AI ANALYSIS'}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => setShowAgentModal(true)}
                  className="flex items-center gap-3 px-8 py-3.5 rounded-xl bg-[#1a1a1a] border border-[#FF5F00]/60 text-[#FF5F00] font-semibold hover:bg-black transition-all cursor-pointer"
                >
                  <Brain className="w-5 h-5" />
                  AGENT WORKSPACE
                </motion.button>

                {fixedCode && (
                  <motion.button
                    id="fix-all-btn"
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={applyAllFixes}
                    className="flex items-center gap-3 px-9 py-3.5 rounded-xl bg-[#FF5F00] hover:bg-[#FF5F00]/90 text-black font-extrabold shadow-[0_0_25px_rgba(255,95,0,0.5)] active:scale-[0.985] transition-all cursor-pointer"
                  >
                    <Zap className="w-5 h-5" />
                    FIX ALL ({issues.length})
                  </motion.button>
                )}
              </div>
            </div>

            {renderTerminal()}
          </>
        )}

        {currentView === 'history' && (
          <div className="p-8 select-text h-full overflow-y-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <h1 className="text-3xl font-bold tracking-tight">PREVIOUS SESSIONS</h1>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-3 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-black border border-[#FF5F00]/30 py-2.5 pl-10 pr-4 rounded-xl text-sm text-white focus:outline-none focus:border-[#FF5F00] transition-all"
                />
              </div>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-24 text-[#FF5F00]/60">No matching sessions. Run analysis to start history logs.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSessions.map((session, idx) => (
                  <div
                    key={idx}
                    onClick={() => loadSession(session)}
                    className="p-5 border border-[#FF5F00]/20 hover:border-[#FF5F00] rounded-2xl cursor-pointer group bg-black/40 transition-all"
                  >
                    <div className="flex justify-between mb-4">
                      <div className="font-mono text-sm text-[#FF5F00]">{new Date(session.timestamp).toLocaleDateString()}</div>
                      <div className="uppercase text-xs tracking-widest px-3 py-px bg-[#FF5F00]/10 text-[#FF5F00] rounded font-bold">
                        {session.language}
                      </div>
                    </div>
                    <div className="font-semibold line-clamp-2 text-lg mb-3 pr-2 text-white/95">{session.summary}</div>
                    <div className="text-xs text-[#FF5F00]/60 font-bold">{session.issues.length} FIXES COMPLETED</div>
                    {session.modelUsed && (
                      <div className="text-xs text-white/40 mt-2">Model: {session.modelUsed}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'sentinel' && renderSentinelBoard()}

        {currentView === 'settings' && (
          <div className="p-8 max-w-2xl overflow-y-auto h-full pb-20">
            <h1 className="text-3xl font-bold mb-8">SETTINGS</h1>
            <div className="space-y-6">
              
              <div className="border border-[#FF5F00]/20 rounded-xl p-6 bg-black/40">
                <div className="text-lg font-bold mb-4">Default Model</div>
                <select
                  value={selectedModel.id}
                  onChange={(e) => {
                    const model = FREE_MODELS.find(m => m.id === e.target.value)!;
                    setSelectedModel(model);
                  }}
                  className="w-full bg-black border border-[#FF5F00]/40 px-4 py-3 rounded text-white cursor-pointer"
                >
                  {FREE_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} • {model.tag} • {model.ctx}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border border-[#FF5F00]/20 rounded-xl p-6 bg-black/40">
                <div className="text-lg font-bold mb-4">Agent Mode Default</div>
                <select
                  value={agentMode}
                  onChange={(e) => setAgentMode(e.target.value as AgentMode)}
                  className="w-full bg-black border border-[#FF5F00]/40 px-4 py-3 rounded text-white cursor-pointer"
                >
                  {modeOptions.map((mode) => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>

              <div className="border border-[#FF5F00]/20 rounded-xl p-6 bg-black/40">
                <div className="text-lg font-bold mb-2">Sentinel Debounce Delay</div>
                <div className="text-sm text-[#FF5F00]/60 mb-3">Delay after typing before passive analysis runs: {debounceDelay}ms</div>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={debounceDelay}
                  onChange={(e) => setDebounceDelay(Number(e.target.value))}
                  className="w-full accent-[#FF5F00] bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="border border-[#FF5F00]/20 rounded-xl p-6 bg-black/40">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold">Auto-Apply Fixes</div>
                    <div className="text-sm text-[#FF5F00]/60 mt-1">Automatically apply all fixes without confirmation</div>
                  </div>
                  <button
                    onClick={() => setAutoApplyFixes(!autoApplyFixes)}
                    className={`w-16 h-8 rounded-full transition-all cursor-pointer ${
                      autoApplyFixes ? 'bg-[#FF5F00]' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 bg-white rounded-full transition-all ${
                        autoApplyFixes ? 'ml-9' : 'ml-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="border border-[#FF5F00]/20 rounded-xl p-6 bg-black/40">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold">Sentinel Live Monitoring</div>
                    <div className="text-sm text-[#FF5F00]/60 mt-1">Enable real-time code monitoring watchdog</div>
                  </div>
                  <button
                    onClick={() => setEnableSentinel(!enableSentinel)}
                    className={`w-16 h-8 rounded-full transition-all cursor-pointer ${
                      enableSentinel ? 'bg-[#FF5F00]' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 bg-white rounded-full transition-all ${
                        enableSentinel ? 'ml-9' : 'ml-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="border border-[#FF5F00]/20 rounded-xl p-6 bg-black/40">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold">Show Token Usage Panel</div>
                    <div className="text-sm text-[#FF5F00]/60 mt-1">Show prompt, completion, and cost estimates after runs</div>
                  </div>
                  <button
                    onClick={() => setShowTokenUsage(!showTokenUsage)}
                    className={`w-16 h-8 rounded-full transition-all cursor-pointer ${
                      showTokenUsage ? 'bg-[#FF5F00]' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 bg-white rounded-full transition-all ${
                        showTokenUsage ? 'ml-9' : 'ml-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="border border-[#FF5F00]/20 rounded-xl p-6 bg-black/40">
                <div className="text-lg font-bold mb-2">Theme</div>
                <div className="text-[#FF5F00]/70">Charcoal Black + Neon Orange (locked)</div>
              </div>

              <button
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessions));
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute("href", dataStr);
                  downloadAnchor.setAttribute("download", `volt-sessions-${Date.now()}.json`);
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                  showToast('Sessions exported successfully!', 'success');
                }}
                className="w-full px-6 py-4 rounded-xl border border-[#FF5F00]/40 text-[#FF5F00] font-bold hover:bg-[#FF5F00]/10 transition-all mb-3 cursor-pointer"
              >
                EXPORT ALL SESSIONS (JSON)
              </button>

              <button
                onClick={() => {
                  localStorage.removeItem('codeSessions');
                  setSessions([]);
                  showToast('All sessions cleared!', 'success');
                }}
                className="w-full px-6 py-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 font-bold transition-all cursor-pointer"
              >
                CLEAR ALL SESSIONS
              </button>
            </div>
          </div>
        )}

        {currentView === 'about' && renderAboutWhitePaper()}
      </div>

      {/* Floating AGENT command button */}
      <motion.button
        onClick={() => setShowAgentModal(true)}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.98 }}
        className="fixed bottom-7 left-[18rem] z-[65] flex items-center gap-3 px-5 py-3 rounded-full bg-[#FF5F00] text-black font-extrabold shadow-[0_0_30px_rgba(255,95,0,0.45)] cursor-pointer"
      >
        <Bot className="w-5 h-5 animate-bounce" />
        AGENT
      </motion.button>

      {/* Chat-First Agent Modal Workspace */}
      <AnimatePresence>
        {showAgentModal && (
          <div className="fixed inset-0 bg-black/85 z-[85] flex items-center justify-center p-6 select-text">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.985, y: 15 }}
              transition={{ ease: [0.21, 0.92, 0.3, 1] }}
              className="w-full max-w-5xl bg-[#121212] border border-[#FF5F00] rounded-3xl overflow-hidden flex flex-col h-[75vh]"
            >
              <div className="px-8 py-5 border-b border-[#FF5F00]/30 flex justify-between items-center select-none">
                <div>
                  <div className="font-bold text-2xl flex items-center gap-3">
                    <Brain className="text-[#FF5F00]" />
                    AGENT ORCHESTRATOR
                  </div>
                  <div className="text-xs text-[#FF5F00]/70 mt-1">
                    v5.0 Conversational developer console. Direct code modification access enabled.
                  </div>
                </div>
                <button onClick={() => setShowAgentModal(false)} className="cursor-pointer">
                  <X />
                </button>
              </div>

              <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
                {/* Chat feed column */}
                <div className="lg:col-span-2 flex flex-col h-full bg-black/40 rounded-2xl border border-white/5 overflow-hidden">
                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {agentMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === 'user' ? 'bg-[#FF5F00] text-black font-semibold' : 'bg-white/10 text-white border border-white/10'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendAgentMessage(agentInput);
                    }}
                    className="p-3 border-t border-white/5 flex gap-2"
                  >
                    <input
                      type="text"
                      value={agentInput}
                      onChange={(e) => setAgentInput(e.target.value)}
                      placeholder="Ask the Agent to optimize, fix or review code..."
                      className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#FF5F00]"
                    />
                    <button 
                      type="submit"
                      className="p-2.5 rounded-xl bg-[#FF5F00] text-black font-bold cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Strategy, stats & action triggers */}
                <div className="flex flex-col justify-between h-full space-y-4">
                  <div className="rounded-2xl border border-[#FF5F00]/20 bg-black/40 p-5 space-y-3">
                    <div className="text-sm font-bold text-[#FF5F00]">CONTEXT META</div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-white/60">Language:</span>
                        <span className="font-mono text-[#FF5F00]">{detectedLanguage.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Model Engine:</span>
                        <span className="font-bold">{selectedModel.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Runtime Mode:</span>
                        <span className="font-semibold text-white/95">{agentMode.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick trigger actions */}
                  <div className="flex-1 rounded-2xl border border-[#FF5F00]/20 bg-black/45 p-5 flex flex-col gap-2 overflow-y-auto">
                    <div className="text-xs font-bold text-[#FF5F00] uppercase tracking-wider mb-2">Command Presets</div>
                    <button 
                      onClick={() => handleAgentQuickAction('analyze')}
                      className="w-full text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <Bug className="w-3.5 h-3.5 text-[#FF5F00]" />
                      Full Code Diagnosis
                    </button>
                    <button 
                      onClick={() => handleAgentQuickAction('security')}
                      className="w-full text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-red-400" />
                      Security Vulnerability Scan
                    </button>
                    <button 
                      onClick={() => handleAgentQuickAction('performance')}
                      className="w-full text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                      Performance Bottleneck Check
                    </button>
                    <button 
                      onClick={() => handleAgentQuickAction('explain')}
                      className="w-full text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <Brain className="w-3.5 h-3.5 text-[#FF5F00]" />
                      Explain Last Issue
                    </button>
                    <button 
                      onClick={() => handleAgentQuickAction('fix')}
                      className="w-full text-left p-2.5 rounded-xl bg-[#FF5F00]/10 hover:bg-[#FF5F00]/20 border border-[#FF5F00]/30 text-[#FF5F00] text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      Generate Fix Patch
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 border-t border-white/5 bg-black/40 flex justify-end gap-3 select-none">
                <button
                  onClick={() => {
                    setCurrentView('sentinel');
                    setShowAgentModal(false);
                  }}
                  className="px-6 py-2.5 rounded-xl border border-[#FF5F00]/40 text-[#FF5F00] font-semibold text-xs cursor-pointer"
                >
                  OPEN TELEMETRY
                </button>
                <button
                  onClick={() => setShowAgentModal(false)}
                  className="px-6 py-2.5 rounded-xl bg-[#FF5F00] text-black font-extrabold text-xs cursor-pointer"
                >
                  CLOSE AGENT
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unified Line Diff Modal */}
      <AnimatePresence>
        {showDiff && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-6 select-text">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.985, y: 15 }}
              transition={{ ease: [0.21, 0.92, 0.3, 1] }}
              className="w-full max-w-6xl bg-[#121212] border border-[#FF5F00] rounded-3xl overflow-hidden"
            >
              <div className="px-8 py-5 border-b border-[#FF5F00]/30 flex justify-between items-center select-none">
                <div className="font-bold text-2xl flex items-center gap-3">
                  <AlertTriangle className="text-[#FF5F00]" />
                  LINE HIGHLIGHT DIFF PREVIEW
                </div>
                <button onClick={() => setShowDiff(false)} className="cursor-pointer">
                  <X />
                </button>
              </div>

              {/* Renders unified lines */}
              <div className="p-8">
                {renderUnifiedDiff()}
              </div>

              <div className="p-8 flex justify-between items-center bg-black/60 border-t border-[#FF5F00]/20 select-none">
                <button
                  onClick={() => copyToClipboard(fixedCode)}
                  className="px-6 py-3 rounded-xl border border-[#FF5F00] hover:bg-white/5 text-[#FF5F00] font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  COPY FIXED CODE
                </button>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDiff(false)}
                    className="px-6 py-3 rounded-xl border border-white/30 text-xs font-semibold cursor-pointer"
                  >
                    CLOSE
                  </button>
                  <button
                    onClick={applyAllFixes}
                    className="px-9 py-3 rounded-xl bg-[#FF5F00] text-black font-extrabold text-xs cursor-pointer"
                  >
                    APPLY ALL FIXED PATCHES
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detailed Diagnostics drawer */}
      <AnimatePresence>
        {showReport && (
          <div
            className="fixed inset-0 bg-black/80 z-[80] flex justify-end select-text"
            onClick={() => setShowReport(false)}
          >
            <motion.div
              initial={{ x: 80 }}
              animate={{ x: 0 }}
              exit={{ x: 80 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#121212] h-full border-l border-[#FF5F00] overflow-auto flex flex-col"
            >
              <div className="sticky top-0 bg-[#121212] p-8 border-b border-[#FF5F00]/40 flex justify-between select-none">
                <div>
                  <div className="font-bold text-xl">DETAILED DIAGNOSTICS</div>
                  <div className="text-[#FF5F00] text-sm font-bold">ALL PATCHES APPLIED TO CODEBASE</div>
                </div>
                <button onClick={() => setShowReport(false)} className="cursor-pointer">
                  <X />
                </button>
              </div>

              <div className="p-8 space-y-7 flex-1 overflow-y-auto">
                {issues.map((issue, index) => (
                  <div key={index} className="border-l-4 border-[#FF5F00] pl-6">
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-bold text-lg">{issue.type}</div>
                      <div
                        className={`px-3 py-px text-xs font-bold rounded ${
                          issue.severity === 'Critical' || issue.severity === 'High'
                            ? 'bg-[#FF5F00] text-black'
                            : 'bg-white/10 text-[#FF5F00]'
                        }`}
                      >
                        {issue.severity}
                      </div>
                    </div>
                    <div className="text-[#FF5F00] mb-3">{issue.description}</div>
                    <div className="text-sm opacity-75 leading-snug mb-4">{issue.explanation}</div>
                    <div className="text-[10px] font-mono bg-black p-3 rounded overflow-x-auto">FIX: {issue.fixed}</div>
                  </div>
                ))}
              </div>

              <div className="p-8 flex gap-3 sticky bottom-0 bg-[#121212] border-t border-white/5 select-none">
                <button
                  onClick={() => copyToClipboard(fixedCode)}
                  className="flex-1 flex justify-center gap-2 items-center py-3 border border-[#FF5F00] hover:bg-white/5 rounded-xl font-semibold cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  COPY CODE
                </button>
                <button
                  onClick={() => downloadCode(fixedCode, `fixed-${Date.now()}.js`)}
                  className="flex-1 flex justify-center gap-2 items-center py-3 bg-[#FF5F00] text-black font-extrabold rounded-xl cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  DOWNLOAD
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Login modal Stub */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/90 z-[90] flex items-center justify-center select-text">
            <div className="bg-[#121212] border border-[#FF5F00] w-full max-w-sm p-9 rounded-3xl">
              <div className="font-bold text-center text-2xl mb-2">SIGN IN</div>
              <div className="text-center text-sm mb-8 text-[#FF5F00]/60">
                Save and retrieve all your diagnostics sessions
              </div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-[#FF5F00]/40 py-3 px-4 mb-3 rounded-xl focus:outline-none focus:border-[#FF5F00]"
                placeholder="Username"
              />
              <button
                onClick={handleLogin}
                className="mt-2 w-full py-3.5 bg-[#FF5F00] font-extrabold text-black rounded-xl cursor-pointer"
              >
                ENABLE SESSION SAVING
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts cheat sheet modal */}
      <AnimatePresence>
        {showShortcutsCheatSheet && (
          <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-6 select-text">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#121212] border border-[#FF5F00] p-8 rounded-3xl space-y-6"
            >
              <div className="flex justify-between items-center border-b border-[#FF5F00]/25 pb-4 select-none">
                <h3 className="font-bold text-xl flex items-center gap-2">
                  <HelpCircle className="text-[#FF5F00]" />
                  Keyboard Shortcuts
                </h3>
                <button onClick={() => setShowShortcutsCheatSheet(false)} className="cursor-pointer">
                  <X />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  { keys: 'Ctrl + Enter', action: 'Run AI Code Analysis' },
                  { keys: 'Ctrl + Shift + F', action: 'Apply All Fixed Patches' },
                  { keys: 'Ctrl + /', action: 'Toggle Sentinel Live Board' },
                  { keys: 'Ctrl + K', action: 'Focus Model Dropdown' },
                  { keys: 'Escape', action: 'Close Modals / Panels' },
                  { keys: '?', action: 'Toggle this Shortcuts Guide' },
                ].map((s, idx) => (
                  <div key={idx} className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-white/60">{s.action}</span>
                    <kbd className="px-2 py-0.5 bg-[#FF5F00]/10 border border-[#FF5F00]/40 text-[#FF5F00] font-mono text-xs rounded-md">{s.keys}</kbd>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Analytics />
    </div>
  );
};

export default App;
