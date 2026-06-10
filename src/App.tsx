import React, { useState, useEffect } from 'react';
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
  PanelRightOpen
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

type View = 'editor' | 'history' | 'settings' | 'sentinel';
type AgentMode = 'manual' | 'assist' | 'auto-syntax' | 'auto-debug' | 'team-review';

const CHARCOAL = '#121212';
const NEON_ORANGE = '#FF5F00';

const modelOptions = [
  'OpenRouter Auto',
  'Claude Sonnet',
  'GPT-4.1',
  'Gemini 2.5 Pro',
  'DeepSeek Coder',
  'Qwen Coder'
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
  const [code, setCode] = useState<string>(
    'function calculateSum(arr) {\n  let sum = 0;\n  for (let i = 0; i < arr.length; i++) {\n    sum += arr[i];\n  }\n  console.log("Sum is: " + sum);\n  return sum;\n}'
  );
  const [language, setLanguage] = useState<string>('javascript');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('javascript');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [fixedCode, setFixedCode] = useState<string>('');
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [showReport, setShowReport] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showAgentModal, setShowAgentModal] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('dev_user');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [scanProgress, setScanProgress] = useState<number>(0);

  const [selectedModel, setSelectedModel] = useState<string>('OpenRouter Auto');
  const [selectedPlugin, setSelectedPlugin] = useState<string>('Test Runner');
  const [selectedSkill, setSelectedSkill] = useState<string>('Syntax Repair');
  const [agentStatus, setAgentStatus] = useState<string>('idle');
  const [agentMessage, setAgentMessage] = useState<string>('Agent ready');

  useEffect(() => {
    const savedSessions = localStorage.getItem('codeSessions');
    if (savedSessions) {
      setSessions(JSON.parse(savedSessions));
    }
  }, []);

  const saveSessions = (newSessions: Session[]) => {
    localStorage.setItem('codeSessions', JSON.stringify(newSessions));
    setSessions(newSessions);
  };

  const detectLanguage = (codeStr: string): string => {
    if ((codeStr.includes('def ') || codeStr.includes('import ')) && codeStr.includes(':')) return 'python';
    if (codeStr.includes('function ') || codeStr.includes('const ') || codeStr.includes('=>')) return 'javascript';
    if (codeStr.includes('#include') || codeStr.includes('int main')) return 'cpp';
    if (codeStr.includes('<html') || codeStr.includes('</div>')) return 'html';
    if (codeStr.includes('{') && codeStr.includes('}') && codeStr.includes(':')) return 'css';
    return 'javascript';
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    const detected = detectLanguage(newCode);
    setDetectedLanguage(detected);
    if (language === 'auto') {
      setLanguage(detected);
    }
  };

  const analyzeCode = async () => {
    setIsAnalyzing(true);
    setIsScanning(true);
    setScanProgress(0);

    const scanInterval = setInterval(() => {
      setScanProgress((prev) => {
        const next = prev + Math.random() * 18 + 8;
        return Math.min(next, 100);
      });
    }, 120);

    await new Promise((resolve) => setTimeout(resolve, 1800));
    clearInterval(scanInterval);
    setScanProgress(100);
    setIsScanning(false);

try {
      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: language === 'auto' ? detectedLanguage : language,
          model: selectedModel
        })
      });
      const data = await res.json();
      if (data.issues) setIssues(data.issues);
      if (data.fixedCode) setFixedCode(data.fixedCode);
      if (data.summary) setAnalysisSummary(data.summary);
    } catch (err) {
      console.error('OpenRouter API error:', err);
    }

    setIsAnalyzing(false);
    setShowDiff(true);
  };

  const applyAllFixes = () => {
    if (!fixedCode) return;

    const btn = document.getElementById('fix-all-btn');
    if (btn) {
      btn.classList.add('animate-pulse');
      setTimeout(() => btn.classList.remove('animate-pulse'), 800);
    }

    setCode(fixedCode);
    setShowDiff(false);

    const newSession: Session = {
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
      language: language === 'auto' ? detectedLanguage : language,
      originalCode: code,
      fixedCode,
      issues,
      summary: `${issues.length} issues fixed. ${issues.filter((i) => i.severity === 'Critical' || i.severity === 'High').length} critical/high severity resolved.`
    };

    const updatedSessions = [newSession, ...sessions].slice(0, 12);
    saveSessions(updatedSessions);
    setShowReport(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-[#FF5F00] text-black px-5 py-2 rounded font-bold z-[120]';
    toast.textContent = 'COPIED TO CLIPBOARD!';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
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

  const renderSelect = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: string[]
  ) => (
    <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#FF5F00]/25 bg-black/50 text-xs text-[#FF5F00]">
      <span className="uppercase tracking-[2px] text-[10px] text-[#FF5F00]/70">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-white outline-none min-w-[130px]"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-black text-white">
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-[#FF5F00]/70" />
    </label>
  );

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans overflow-hidden" style={{ background: CHARCOAL }}>
      <div className="h-16 border-b border-[#FF5F00]/30 flex items-center justify-between px-6 bg-black/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded bg-[#FF5F00] flex items-center justify-center">
              <Code2 className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="font-bold tracking-[3px] text-xl">VOLT</div>
              <div className="text-[9px] text-[#FF5F00] -mt-1">CODE AI</div>
            </div>
          </div>
          <div className="ml-4 px-3 py-0.5 text-xs border border-[#FF5F00]/40 rounded">v4.9 AGENTIC</div>
        </div>

        <div className="flex items-center gap-4">
          {!isLoggedIn ? (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 px-5 py-1.5 rounded bg-[#FF5F00] hover:bg-[#FF5F00]/90 text-black font-semibold transition-all active:scale-[0.985]"
            >
              <User className="w-4 h-4" /> LOGIN TO SAVE
            </button>
          ) : (
            <div className="flex items-center gap-2 text-sm px-4 py-1 rounded border border-[#FF5F00]/40 text-[#FF5F00]">
              <User className="w-4 h-4" /> {username}
            </div>
          )}
        </div>
      </div>

      <div className="flex h-[calc(100vh-4rem)]">
        <div className="w-64 border-r border-[#FF5F00]/20 bg-black/50 flex flex-col">
          <div className="p-5">
            <div
              onClick={() => setCurrentView('editor')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer mb-1 transition-all ${
                currentView === 'editor' ? 'bg-[#FF5F00] text-black font-bold' : 'hover:bg-white/5 text-[#FF5F00]'
              }`}
            >
              <Play className="w-5 h-5" /> NEW ANALYSIS
            </div>

            <div
              onClick={() => setCurrentView('history')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer mb-1 transition-all ${
                currentView === 'history' ? 'bg-[#FF5F00] text-black font-bold' : 'hover:bg-white/5 text-[#FF5F00]'
              }`}
            >
              <History className="w-5 h-5" /> SESSION HISTORY
            </div>

            <div
              onClick={() => setCurrentView('sentinel')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer mb-1 transition-all ${
                currentView === 'sentinel' ? 'bg-[#FF5F00] text-black font-bold' : 'hover:bg-white/5 text-[#FF5F00]'
              }`}
            >
              <Shield className="w-5 h-5" /> SENTINEL TAB
            </div>

            <div
              onClick={() => setCurrentView('settings')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
                currentView === 'settings' ? 'bg-[#FF5F00] text-black font-bold' : 'hover:bg-white/5 text-[#FF5F00]'
              }`}
            >
              <Settings className="w-5 h-5" /> SETTINGS
            </div>
          </div>

          <div className="mt-auto p-5 border-t border-[#FF5F00]/20 text-xs text-[#FF5F00]/70">
            HIGH-VOLTAGE DARK MODE
            <br />
            NEON ORANGE #FF5F00
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {currentView === 'editor' && (
            <>
              <div className="px-8 py-5 border-b border-[#FF5F00]/20 flex items-start justify-between gap-6 flex-wrap">
                <div>
                  <div className="text-[#FF5F00] text-sm tracking-[2px] font-semibold">MULTI-LANGUAGE EDITOR</div>
                  <div className="text-2xl font-bold tracking-tight">AI Bug Finder, Agent Runner & Optimizer</div>
                </div>

                <div className="flex items-center gap-3 flex-wrap justify-end">
                  {renderSelect('Model', selectedModel, setSelectedModel, modelOptions)}
                  {renderSelect('Plugin', selectedPlugin, setSelectedPlugin, pluginOptions)}
                  {renderSelect('Skill', selectedSkill, setSelectedSkill, skillOptions)}
                  {renderSelect('Mode', agentMode, (v) => setAgentMode(v as AgentMode), modeOptions)}

                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-black border border-[#FF5F00]/60 px-4 py-2 text-sm rounded focus:outline-none focus:border-[#FF5F00]"
                  >
                    {languages.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>

                  <div className="text-xs px-3 py-2 rounded bg-black border border-[#FF5F00]/40 text-[#FF5F00]">
                    DETECTED: {detectedLanguage.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="flex-1 p-8 relative">
                <div
                  className="relative h-full rounded-2xl border border-[#FF5F00]/30 bg-[#0a0a0a] overflow-hidden shadow-2xl"
                  style={{ boxShadow: '0 0 0 1px #FF5F00, 0 25px 60px -15px rgba(0,0,0,0.6)' }}
                >
                  <AnimatePresence>
                    {isScanning && (
                      <div
                        className="absolute left-0 right-0 z-50 pointer-events-none"
                        style={{ top: `${scanProgress * 0.94}%`, transition: 'top 120ms linear' }}
                      >
                        <div
                          className="h-[3px] w-full bg-[#FF5F00]"
                          style={{ boxShadow: `0 0 22px ${NEON_ORANGE}, 0 0 50px ${NEON_ORANGE}` }}
                        />
                      </div>
                    )}
                  </AnimatePresence>

                  <textarea
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    spellCheck={false}
                    className="w-full h-full resize-none bg-transparent p-8 font-mono text-[15px] leading-[1.65] outline-none text-[#EDEDED] caret-[#FF5F00]"
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      boxShadow: 'inset 0 0 0 1px rgba(255,95,0,0.1)'
                    }}
                  />
                </div>

                <div className="absolute bottom-9 right-9 flex gap-3 flex-wrap justify-end">
                  <motion.button
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={analyzeCode}
                    disabled={isAnalyzing}
                    className="flex items-center gap-3 px-8 py-3.5 rounded-xl bg-black border-2 border-[#FF5F00] text-[#FF5F00] font-semibold disabled:opacity-60 active:bg-[#FF5F00] active:text-black transition-all"
                  >
                    <Bug className="w-5 h-5" /> {isAnalyzing ? 'ANALYZING...' : 'RUN AI ANALYSIS'}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => setShowAgentModal(true)}
                    className="flex items-center gap-3 px-8 py-3.5 rounded-xl bg-[#1a1a1a] border border-[#FF5F00]/60 text-[#FF5F00] font-semibold hover:bg-black transition-all"
                  >
                    <Brain className="w-5 h-5" /> OPEN AGENT
                  </motion.button>

                  {fixedCode && (
                    <motion.button
                      id="fix-all-btn"
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={applyAllFixes}
                      className="flex items-center gap-3 px-9 py-3.5 rounded-xl bg-[#FF5F00] hover:bg-[#FF5F00]/90 text-black font-extrabold shadow-[0_0_25px_rgba(255,95,0,0.5)] active:scale-[0.985] transition-all"
                    >
                      <Zap className="w-5 h-5" /> FIX ALL ({issues.length})
                    </motion.button>
                  )}
                </div>
              </div>
            </>
          )}

          {currentView === 'history' && (
            <div className="p-8">
              <div className="text-3xl font-bold tracking-tight mb-8">PREVIOUS SESSIONS</div>
              {sessions.length === 0 ? (
                <div className="text-center py-24 text-[#FF5F00]/60">No saved sessions yet. Run an analysis to save.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sessions.map((session, idx) => (
                    <div
                      key={idx}
                      onClick={() => loadSession(session)}
                      className="p-5 border border-[#FF5F00]/20 hover:border-[#FF5F00] rounded-2xl cursor-pointer group bg-black/40 transition-all"
                    >
                      <div className="flex justify-between mb-4">
                        <div className="font-mono text-sm text-[#FF5F00]">{new Date(session.timestamp).toLocaleDateString()}</div>
                        <div className="uppercase text-xs tracking-widest px-3 py-px bg-[#FF5F00]/10 text-[#FF5F00] rounded">
                          {session.language}
                        </div>
                      </div>
                      <div className="font-semibold line-clamp-2 text-lg mb-3 pr-2">{session.summary}</div>
                      <div className="text-xs text-[#FF5F00]/60">{session.issues.length} FIXES APPLIED</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentView === 'sentinel' && (
            <div className="p-8 h-full overflow-auto">
              <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
                <div>
                  <div className="text-[#FF5F00] text-sm tracking-[2px] font-semibold">SELF-ERROR HANDLING WORKSPACE</div>
                  <div className="text-3xl font-bold">SENTINEL TAB</div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="px-4 py-2 rounded-xl border border-[#FF5F00]/30 bg-black/40 text-[#FF5F00] text-sm">
                    Active Model: {selectedModel}
                  </div>
                  <div className="px-4 py-2 rounded-xl border border-[#FF5F00]/30 bg-black/40 text-[#FF5F00] text-sm">
                    Skill: {selectedSkill}
                  </div>
                  <div className="px-4 py-2 rounded-xl border border-[#FF5F00]/30 bg-black/40 text-[#FF5F00] text-sm">
                    Plugin: {selectedPlugin}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 rounded-3xl border border-[#FF5F00]/20 bg-black/40 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-5 h-5 text-[#FF5F00]" />
                    <div className="text-xl font-bold">Internal Operations Queue</div>
                  </div>

                  <div className="space-y-4">
                    {[
                      'Skill Creator staging room initialized',
                      'Skill Modifier validator waiting for input',
                      'Plugin Creator scaffold engine standby',
                      'Plugin Modifier compatibility checks ready',
                      'Sentinel recovery monitor active'
                    ].map((item) => (
                      <div key={item} className="rounded-2xl border border-[#FF5F00]/15 bg-[#101010] p-4 flex items-center justify-between gap-3">
                        <span className="text-sm text-white/90">{item}</span>
                        <span className="text-[10px] px-3 py-1 rounded-full bg-[#FF5F00]/10 text-[#FF5F00] tracking-[2px]">
                          READY
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#FF5F00]/20 bg-black/40 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="w-5 h-5 text-[#FF5F00]" />
                    <div className="text-xl font-bold">Skills Room</div>
                  </div>

                  <div className="space-y-3">
                    {skillOptions.map((skill) => (
                      <div key={skill} className="rounded-xl border border-[#FF5F00]/15 bg-[#0f0f0f] px-4 py-3 text-sm text-[#FF5F00]">
                        {skill}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#FF5F00]/20 bg-black/40 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Wrench className="w-5 h-5 text-[#FF5F00]" />
                    <div className="text-xl font-bold">Plugins Room</div>
                  </div>

                  <div className="space-y-3">
                    {pluginOptions.map((plugin) => (
                      <div key={plugin} className="rounded-xl border border-[#FF5F00]/15 bg-[#0f0f0f] px-4 py-3 text-sm text-[#FF5F00]">
                        {plugin}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="xl:col-span-2 rounded-3xl border border-[#FF5F00]/20 bg-black/40 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <PanelRightOpen className="w-5 h-5 text-[#FF5F00]" />
                    <div className="text-xl font-bold">Scan & Fix Preview</div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-[#0a0a0a] border border-red-500/20 p-4">
                      <div className="text-xs tracking-[2px] text-red-400 mb-3">CURRENT / SCANNED</div>
                      <pre className="font-mono text-xs whitespace-pre-wrap text-red-200/80 leading-relaxed max-h-[320px] overflow-auto">
                        {code}
                      </pre>
                    </div>

                    <div className="rounded-2xl bg-[#0a0a0a] border border-[#FF5F00]/20 p-4">
                      <div className="text-xs tracking-[2px] text-[#FF5F00] mb-3">PROPOSED / FIXED</div>
                      <pre className="font-mono text-xs whitespace-pre-wrap text-[#FFB380] leading-relaxed max-h-[320px] overflow-auto">
                        {fixedCode || '// Agent proposed patch preview will appear here'}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'settings' && (
            <div className="p-8 max-w-xl">
              <div className="text-3xl font-bold mb-8">SETTINGS</div>
              <div className="space-y-6 text-[#FF5F00]/90">
                <div className="border border-[#FF5F00]/20 rounded p-6">Theme: Charcoal Black + Neon Orange (locked)</div>
                <div className="border border-[#FF5F00]/20 rounded p-6">Auto Language Detection: ENABLED</div>
                <div className="border border-[#FF5F00]/20 rounded p-6">Session Storage: LOCAL BROWSER STORAGE</div>
                <div className="border border-[#FF5F00]/20 rounded p-6">Agent Mode: {agentMode}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <motion.button
        onClick={() => setShowAgentModal(true)}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.98 }}
        className="fixed bottom-7 left-[18rem] z-[65] flex items-center gap-3 px-5 py-3 rounded-full bg-[#FF5F00] text-black font-extrabold shadow-[0_0_30px_rgba(255,95,0,0.45)]"
      >
        <Bot className="w-5 h-5" />
        AGENT
      </motion.button>

      <AnimatePresence>
        {showAgentModal && (
          <div className="fixed inset-0 bg-black/85 z-[85] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.985, y: 15 }}
              transition={{ ease: [0.21, 0.92, 0.3, 1] }}
              className="w-full max-w-5xl bg-[#121212] border border-[#FF5F00] rounded-3xl overflow-hidden"
            >
              <div className="px-8 py-5 border-b border-[#FF5F00]/30 flex justify-between items-center">
                <div>
                  <div className="font-bold text-2xl flex items-center gap-3">
                    <Brain className="text-[#FF5F00]" />
                    AGENT TEAM CONTROL
                  </div>
                  <div className="text-sm text-[#FF5F00]/70 mt-1">
                    Floating command center for model, plugin, skill, sentinel and execution flow
                  </div>
                </div>
                <button onClick={() => setShowAgentModal(false)}>
                  <X />
                </button>
              </div>

              <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-[#FF5F00]/20 bg-black/40 p-6 space-y-4">
                  <div className="text-lg font-bold">Runtime Controls</div>
                  {renderSelect('Model', selectedModel, setSelectedModel, modelOptions)}
                  {renderSelect('Plugin', selectedPlugin, setSelectedPlugin, pluginOptions)}
                  {renderSelect('Skill', selectedSkill, setSelectedSkill, skillOptions)}
                  {renderSelect('Mode', agentMode, (v) => setAgentMode(v as AgentMode), modeOptions)}
                </div>

                <div className="rounded-2xl border border-[#FF5F00]/20 bg-black/40 p-6">
                  <div className="text-lg font-bold mb-4">Agent Mission</div>
                  <div className="space-y-3 text-sm text-white/80 leading-relaxed">
                    <div className="rounded-xl border border-[#FF5F00]/10 bg-[#0f0f0f] p-4">
                      Read active page context and route work to the correct agent behavior.
                    </div>
                    <div className="rounded-xl border border-[#FF5F00]/10 bg-[#0f0f0f] p-4">
                      Use Sentinel for internal skill/plugin staging, validation and self-repair workflows.
                    </div>
                    <div className="rounded-xl border border-[#FF5F00]/10 bg-[#0f0f0f] p-4">
                      Support future OpenRouter orchestration, uploaded ecosystem specs and compatibility conversion.
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 pb-8 flex justify-end gap-4">
                <button
                  onClick={() => {
                    setCurrentView('sentinel');
                    setShowAgentModal(false);
                  }}
                  className="px-7 py-3 rounded-xl border border-[#FF5F00]/40 text-[#FF5F00]"
                >
                  OPEN SENTINEL
                </button>
                <button
                  onClick={() => setShowAgentModal(false)}
                  className="px-8 py-3 rounded-xl bg-[#FF5F00] text-black font-bold"
                >
                  SAVE AGENT STATE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDiff && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.985, y: 15 }}
              transition={{ ease: [0.21, 0.92, 0.3, 1] }}
              className="w-full max-w-6xl bg-[#121212] border border-[#FF5F00] rounded-3xl overflow-hidden"
            >
              <div className="px-8 py-5 border-b border-[#FF5F00]/30 flex justify-between items-center">
                <div className="font-bold text-2xl flex items-center gap-3">
                  <AlertTriangle className="text-[#FF5F00]" /> AI ANALYSIS COMPLETE — DIFF PREVIEW
                </div>
                <button onClick={() => setShowDiff(false)}>
                  <X />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[#FF5F00]/10">
                <div className="bg-[#0a0a0a] p-8">
                  <div className="uppercase text-xs tracking-[3px] mb-4 text-red-400">ORIGINAL CODE</div>
                  <pre className="font-mono text-sm whitespace-pre-wrap text-red-300/70 leading-relaxed">{code}</pre>
                </div>

                <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-[#0a0a0a] p-8 border-l border-[#FF5F00]/30">
                  <div className="uppercase text-xs tracking-[3px] mb-4 text-[#FF5F00]">FIXED CODE — NEON OPTIMIZED</div>
                  <pre className="font-mono text-sm whitespace-pre-wrap text-[#FF5F00] leading-relaxed">{fixedCode}</pre>
                </motion.div>
              </div>

              <div className="p-8 flex justify-end gap-4 bg-black/60 border-t border-[#FF5F00]/20">
                <button onClick={() => setShowDiff(false)} className="px-7 py-3 rounded-xl border border-white/30">
                  CLOSE
                </button>
                <button onClick={applyAllFixes} className="px-9 py-3 rounded-xl bg-[#FF5F00] text-black font-bold">
                  APPLY ALL FIXES NOW
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReport && (
          <div className="fixed inset-0 bg-black/80 z-[80] flex justify-end" onClick={() => setShowReport(false)}>
            <motion.div
              initial={{ x: 80 }}
              animate={{ x: 0 }}
              exit={{ x: 80 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#121212] h-full border-l border-[#FF5F00] overflow-auto"
            >
              <div className="sticky top-0 bg-[#121212] p-8 border-b border-[#FF5F00]/40 flex justify-between">
                <div>
                  <div className="font-bold text-xl">DETAILED FIX REPORT</div>
                  <div className="text-[#FF5F00] text-sm">ALL FIXES APPLIED SUCCESSFULLY</div>
                </div>
                <button onClick={() => setShowReport(false)}>
                  <X />
                </button>
              </div>

              <div className="p-8 space-y-7">
                {issues.map((issue, index) => (
                  <div key={index} className="border-l-4 border-[#FF5F00] pl-6">
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-bold text-lg">{issue.type}</div>
                      <div
                        className={`px-3 py-px text-xs font-bold rounded ${
                          issue.severity === 'Critical' || issue.severity === 'High'
                            ? 'bg-[#FF5F00] text-black'
                            : 'bg-white/10'
                        }`}
                      >
                        {issue.severity}
                      </div>
                    </div>
                    <div className="text-[#FF5F00] mb-3">{issue.description}</div>
                    <div className="text-sm opacity-75 leading-snug mb-4">{issue.explanation}</div>
                    <div className="text-[10px] font-mono bg-black p-3 rounded">FIX: {issue.fixed}</div>
                  </div>
                ))}
              </div>

              <div className="p-8 flex gap-3 sticky bottom-0 bg-[#121212]">
                <button
                  onClick={() => copyToClipboard(fixedCode)}
                  className="flex-1 flex justify-center gap-2 items-center py-3 border border-[#FF5F00] hover:bg-white/5 rounded-xl"
                >
                  <Copy className="w-4 h-4" /> COPY FIXED CODE
                </button>
                <button
                  onClick={() => downloadCode(fixedCode, `fixed-${Date.now()}.js`)}
                  className="flex-1 flex justify-center gap-2 items-center py-3 bg-[#FF5F00] text-black font-bold rounded-xl"
                >
                  <Download className="w-4 h-4" /> DOWNLOAD
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/90 z-[90] flex items-center justify-center">
            <div className="bg-[#121212] border border-[#FF5F00] w-full max-w-sm p-9 rounded-3xl">
              <div className="font-bold text-center text-2xl mb-2">SIGN IN</div>
              <div className="text-center text-sm mb-8 text-[#FF5F00]/60">Save and revisit all your analysis sessions</div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black border border-[#FF5F00]/40 py-3 px-4 mb-3 rounded"
                placeholder="Username"
              />
              <button onClick={handleLogin} className="mt-2 w-full py-3.5 bg-[#FF5F00] font-extrabold text-black rounded-xl">
                SIGN IN & ENABLE HISTORY
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      <Analytics />
    </div>
  );
};

export default App;
