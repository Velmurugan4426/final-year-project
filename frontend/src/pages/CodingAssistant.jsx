import { useRef, useState } from "react";
import {
    ArrowDown,
    ArrowUp,
    Bot,
    Bug,
    Check,
    ChevronDown,
    Code2,
    Copy,
    FileCode2,
    FlaskConical,
    Gauge,
    Lightbulb,
    LoaderCircle,
    MessageCircle,
    RotateCcw,
    Send,
    ShieldCheck,
    Sparkles,
    Trash2
} from "lucide-react";
import "./CodingAssistant.css";
import { getAuthToken } from "../utils/authSession";

const API_BASE = import.meta.env.VITE_API_URL || "";

const LANGUAGES = [
    "JavaScript",
    "TypeScript",
    "Python",
    "Java",
    "C++",
    "C#",
    "Go",
    "Rust",
    "SQL",
    "HTML",
    "CSS",
    "Other"
];

const TASKS = [
    { value: "Debug", label: "Debug", icon: Bug },
    { value: "Explain", label: "Explain", icon: Lightbulb },
    { value: "Review", label: "Review", icon: ShieldCheck },
    { value: "Optimize", label: "Optimize", icon: Gauge },
    { value: "Write tests", label: "Write tests", icon: FlaskConical }
];

const QUICK_PROMPTS = [
    { label: "Find the bug", question: "Find the most likely bug. Explain the root cause and suggest a minimal fix." },
    { label: "Explain this code", question: "Explain how this code works, step by step, including important edge cases." },
    { label: "Review quality", question: "Review this code for correctness, security, readability, and performance. Prioritize actionable issues." },
    { label: "Write tests", question: "Suggest focused unit tests for normal cases, edge cases, and failure cases." }
];

function getToken() {
    const token = getAuthToken();
    if (!token) throw new Error("Please sign in to use Coding Assistant.");
    return token;
}

async function askCodingAssistant(payload) {
    let response;
    try {
        response = await fetch(`${API_BASE}/api/coding-assistant/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getToken()}`
            },
            body: JSON.stringify(payload)
        });
    } catch {
        throw new Error("Cannot reach the learning assistant API. Check that the backend is running and try again.");
    }

    if (!response.ok) {
        let message = `Coding Assistant request failed (${response.status}).`;
        try {
            const data = await response.json();
            message = data.message || data.error || message;
        } catch {
            message = response.statusText || message;
        }
        throw new Error(message);
    }

    const data = await response.json();
    if (!data.reply) throw new Error("The coding assistant returned an empty response.");
    return data.reply;
}

function formatMessage(content) {
    const sections = [];
    const lines = content.split("\n");
    let paragraph = [];
    let codeLines = [];
    let codeLanguage = "";
    let inCode = false;

    const flushParagraph = () => {
        if (paragraph.length) {
            sections.push({ type: "paragraph", text: paragraph.join("\n") });
            paragraph = [];
        }
    };

    for (const line of lines) {
        if (line.trimStart().startsWith("```")) {
            if (inCode) {
                sections.push({ type: "code", text: codeLines.join("\n"), language: codeLanguage });
                codeLines = [];
                codeLanguage = "";
                inCode = false;
            } else {
                flushParagraph();
                inCode = true;
                codeLanguage = line.trim().slice(3).trim();
            }
        } else if (inCode) {
            codeLines.push(line);
        } else if (line.trim() === "") {
            flushParagraph();
        } else {
            paragraph.push(line);
        }
    }

    if (inCode) sections.push({ type: "code", text: codeLines.join("\n"), language: codeLanguage });
    flushParagraph();
    return sections;
}

function AssistantContent({ content, onCopy }) {
    return (
        <div className="coding-message-content">
            {formatMessage(content).map((section, index) => {
                if (section.type === "code") {
                    return (
                        <div className="coding-response-code" key={`code-${index}`}>
                            <div className="coding-response-code-head">
                                <span>{section.language || "CODE"}</span>
                                <button onClick={() => onCopy(section.text)} title="Copy code">
                                    <Copy size={13} /> Copy
                                </button>
                            </div>
                            <pre><code>{section.text}</code></pre>
                        </div>
                    );
                }

                const isList = section.text.split("\n").every((line) => /^\s*([-*]|\d+\.)\s/.test(line));
                if (isList) {
                    return (
                        <ul key={`list-${index}`}>
                            {section.text.split("\n").map((line, itemIndex) => (
                                <li key={`item-${itemIndex}`}>{line.replace(/^\s*([-*]|\d+\.)\s/, "")}</li>
                            ))}
                        </ul>
                    );
                }
                return <p key={`paragraph-${index}`}>{section.text}</p>;
            })}
        </div>
    );
}

function CodingAssistant() {
    const [code, setCode] = useState("");
    const [language, setLanguage] = useState("JavaScript");
    const [task, setTask] = useState("Debug");
    const [question, setQuestion] = useState("");
    const [analysis, setAnalysis] = useState(null);
    const [chat, setChat] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [analyzing, setAnalyzing] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [copied, setCopied] = useState(false);
    const editorRef = useRef(null);
    const chatEndRef = useRef(null);
    const lineCount = Math.max(1, code.split("\n").length);
    const codeExtension = {
        JavaScript: "js",
        TypeScript: "ts",
        Python: "py",
        Java: "java",
        "C++": "cpp",
        "C#": "cs",
        Go: "go",
        Rust: "rs",
        SQL: "sql",
        HTML: "html",
        CSS: "css"
    }[language] || "txt";

    const copyText = async (text, message = "Copied to clipboard.") => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setNotice(message);
            window.setTimeout(() => {
                setNotice("");
                setCopied(false);
            }, 2500);
        } catch {
            setError("Clipboard access was denied. Select and copy the text instead.");
        }
    };

    const analyzeCode = async () => {
        setError("");
        setNotice("");
        setAnalyzing(true);
        try {
            const reply = await askCodingAssistant({
                question: question.trim() || `Please ${task.toLowerCase()} this code. Identify the key issues and show a practical solution.`,
                code,
                language,
                task,
                history: []
            });
            setAnalysis(reply);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setAnalyzing(false);
        }
    };

    const sendMessage = async (message = chatInput) => {
        const text = message.trim();
        if (!text || sending) return;
        setError("");
        setNotice("");
        const nextChat = [...chat, { role: "user", content: text }];
        setChat(nextChat);
        setChatInput("");
        setSending(true);

        try {
            const reply = await askCodingAssistant({
                question: text,
                code,
                language,
                task: "Ask",
                history: chat.slice(-10)
            });
            setChat((current) => [...current, { role: "assistant", content: reply }]);
            window.requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }));
        } catch (requestError) {
            setChat((current) => current.slice(0, -1));
            setChatInput(text);
            setError(requestError.message);
        } finally {
            setSending(false);
        }
    };

    const onEditorKeyDown = (event) => {
        if (event.key === "Tab") {
            event.preventDefault();
            const editor = event.currentTarget;
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const updated = `${code.slice(0, start)}    ${code.slice(end)}`;
            setCode(updated);
            requestAnimationFrame(() => {
                editorRef.current?.setSelectionRange(start + 4, start + 4);
            });
        } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            analyzeCode();
        }
    };

    const clearEditor = () => {
        setCode("");
        setQuestion("");
        setAnalysis(null);
        setError("");
        editorRef.current?.focus();
    };

    const scrollChat = (direction) => {
        chatEndRef.current?.parentElement?.scrollBy({
            top: direction * 280,
            behavior: "smooth"
        });
    };

    return (
        <main className="coding-page">
            <header className="coding-page-heading">
                <div>
                    <span className="coding-eyebrow">AI POWERED · YOUR PAIR PROGRAMMER</span>
                    <h1>Make your next move in code.</h1>
                    <p>Debug smarter, understand the why, and ship code you can stand behind.</p>
                </div>
                <div className="coding-online-badge"><span /> AI assistant ready</div>
            </header>

            {error && (
                <div className="coding-alert" role="alert">
                    <span>{error}</span>
                    <button onClick={() => setError("")} aria-label="Dismiss error">×</button>
                </div>
            )}
            {notice && <div className="coding-notice">{notice}</div>}

            <div className="coding-workspace">
                <section className="coding-main-column">
                    <div className="coding-editor-card">
                        <div className="coding-editor-toolbar">
                            <div className="coding-file-tab">
                                <FileCode2 size={16} />
                                <span>scratch.{codeExtension}</span>
                                {code && <span className="coding-unsaved-dot" title="Unsaved changes" />}
                            </div>
                            <div className="coding-editor-controls">
                                <label className="coding-language-select">
                                    <span className="coding-sr-only">Programming language</span>
                                    <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                                        {LANGUAGES.map((item) => <option key={item}>{item}</option>)}
                                    </select>
                                    <ChevronDown size={14} />
                                </label>
                                <button className="coding-icon-button" onClick={() => copyText(code, "Code copied.")} disabled={!code} title={copied ? "Copied" : "Copy code"}>
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                                <button className="coding-icon-button" onClick={clearEditor} disabled={!code && !question && !analysis} title="Clear editor">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="coding-editor-body">
                            <div className="coding-line-numbers" aria-hidden="true">
                                {Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}
                            </div>
                            <textarea
                                ref={editorRef}
                                className="coding-editor-input"
                                value={code}
                                maxLength={24000}
                                onChange={(event) => setCode(event.target.value)}
                                onKeyDown={onEditorKeyDown}
                                onScroll={(event) => {
                                    const gutter = event.currentTarget.previousElementSibling;
                                    if (gutter) gutter.scrollTop = event.currentTarget.scrollTop;
                                }}
                                spellCheck="false"
                                autoCapitalize="off"
                                autoComplete="off"
                                autoCorrect="off"
                                aria-label={`${language} code editor`}
                                placeholder={`// Paste or write your ${language} code here\n// Ask the sidekick a question or choose an action below.\n\n`}
                            />
                        </div>

                        <div className="coding-editor-footer">
                            <span><Code2 size={14} /> {language}</span>
                            <span>{code.length.toLocaleString()} characters · {lineCount} lines</span>
                            <span className="coding-shortcut-hint">Ctrl + Enter to analyze</span>
                        </div>
                    </div>

                    <div className="coding-task-card">
                        <div className="coding-task-heading">
                            <div>
                                <span className="coding-eyebrow">WHAT DO YOU NEED?</span>
                                <h2>Choose a code action</h2>
                            </div>
                        </div>
                        <div className="coding-task-list">
                            {TASKS.map(({ value, label, icon: Icon }) => (
                                <button
                                    className={`coding-task-button ${task === value ? "is-active" : ""}`}
                                    key={value}
                                    onClick={() => setTask(value)}
                                    aria-pressed={task === value}
                                >
                                    <Icon size={17} /> {label}
                                </button>
                            ))}
                        </div>
                        <label className="coding-question-label" htmlFor="coding-question">
                            Add context <span>optional</span>
                        </label>
                        <textarea
                            id="coding-question"
                            className="coding-question-input"
                            value={question}
                            onChange={(event) => setQuestion(event.target.value)}
                            maxLength={8000}
                            placeholder="What should the assistant focus on? Share an error message, expected behavior, or constraints..."
                            rows={3}
                        />
                        <div className="coding-analyze-row">
                            <p><ShieldCheck size={15} /> Your code is sent securely to your configured AI provider.</p>
                            <button className="coding-analyze-button" onClick={analyzeCode} disabled={analyzing || (!code.trim() && !question.trim())}>
                                {analyzing ? <LoaderCircle size={17} className="coding-spin" /> : <Sparkles size={17} />}
                                {analyzing ? "Analyzing..." : "Analyze code"}
                            </button>
                        </div>
                    </div>

                    {analysis && (
                        <section className="coding-analysis-card">
                            <div className="coding-analysis-heading">
                                <div className="coding-analysis-title">
                                    <div className="coding-analysis-icon"><Sparkles size={18} /></div>
                                    <div><span className="coding-eyebrow">CODE REVIEW</span><h2>{task} analysis</h2></div>
                                </div>
                                <div className="coding-analysis-actions">
                                    <button onClick={() => copyText(analysis, "Analysis copied.")}><Copy size={15} /> Copy</button>
                                    <button onClick={analyzeCode} disabled={analyzing}><RotateCcw size={15} /> Retry</button>
                                </div>
                            </div>
                            <AssistantContent content={analysis} onCopy={copyText} />
                            <div className="coding-analysis-footnote"><ShieldCheck size={14} /> AI-generated guidance can be wrong. Test changes before using them.</div>
                        </section>
                    )}
                </section>

                <aside className="coding-sidekick" aria-label="Coding assistant sidekick">
                    <div className="coding-sidekick-head">
                        <div className="coding-sidekick-avatar"><Bot size={21} /><span /></div>
                        <div className="coding-sidekick-title">
                            <strong>Code sidekick</strong>
                            <span>Here while you build</span>
                        </div>
                        <button className="coding-icon-button" onClick={() => { setChat([]); setError(""); }} disabled={!chat.length} title="Clear conversation">
                            <RotateCcw size={15} />
                        </button>
                    </div>

                    <div className="coding-sidekick-context">
                        <Code2 size={15} />
                        <span>{language} context</span>
                        <span className={code.trim() ? "coding-context-live" : ""}>{code.trim() ? "Code attached" : "No code yet"}</span>
                    </div>

                    <div className="coding-chat-messages">
                        {!chat.length && (
                            <div className="coding-sidekick-welcome">
                                <div className="coding-welcome-icon"><MessageCircle size={20} /></div>
                                <h3>Hey, let’s solve it together.</h3>
                                <p>Ask me about your code, an error, or what to try next. I can see the code in your editor.</p>
                                <span className="coding-suggestion-label">TRY ASKING</span>
                                <div className="coding-suggestions">
                                    {QUICK_PROMPTS.map((prompt) => (
                                        <button key={prompt.label} onClick={() => sendMessage(prompt.question)} disabled={sending}>
                                            {prompt.label} <ArrowUp size={13} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {chat.map((message, index) => (
                            <article className={`coding-chat-message is-${message.role}`} key={`${message.role}-${index}`}>
                                {message.role === "assistant" && <div className="coding-chat-avatar"><Bot size={14} /></div>}
                                <div className="coding-chat-bubble">
                                    <AssistantContent content={message.content} onCopy={copyText} />
                                    {message.role === "assistant" && <button className="coding-copy-reply" onClick={() => copyText(message.content)}><Copy size={13} /> Copy</button>}
                                </div>
                                {message.role === "user" && <div className="coding-chat-avatar is-user">Y</div>}
                            </article>
                        ))}
                        {sending && (
                            <div className="coding-thinking"><span /><span /><span /> Sidekick is thinking</div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {chat.length === 0 && (
                        <div className="coding-sidekick-capabilities">
                            <span><Bug size={14} /> Debug</span>
                            <span><Lightbulb size={14} /> Explain</span>
                            <span><ShieldCheck size={14} /> Review</span>
                        </div>
                    )}

                    <form
                        className="coding-chat-compose"
                        onSubmit={(event) => { event.preventDefault(); sendMessage(); }}
                    >
                        <textarea
                            value={chatInput}
                            onChange={(event) => setChatInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    sendMessage();
                                }
                            }}
                            placeholder="Ask your code sidekick..."
                            rows={2}
                            maxLength={8000}
                            aria-label="Message your coding assistant"
                        />
                        <div className="coding-chat-compose-footer">
                            <span>Enter to send · Shift + Enter for newline</span>
                            <button type="submit" disabled={sending || !chatInput.trim()} aria-label="Send message">
                                {sending ? <LoaderCircle size={17} className="coding-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    </form>
                    <div className="coding-sidekick-disclaimer">AI can make mistakes. Verify code before shipping.</div>
                    <div className="coding-chat-scroll-controls">
                        <button onClick={() => scrollChat(-1)} title="Scroll conversation up"><ArrowUp size={13} /></button>
                        <button onClick={() => scrollChat(1)} title="Scroll conversation down"><ArrowDown size={13} /></button>
                    </div>
                </aside>
            </div>
            <footer className="coding-page-footnote"><ShieldCheck size={15} /> Do not paste secrets, credentials, or private customer data into AI prompts.</footer>
        </main>
    );
}

export default CodingAssistant;
