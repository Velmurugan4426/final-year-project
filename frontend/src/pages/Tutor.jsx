import { useEffect, useMemo, useRef, useState } from "react";

import {
    Plus,
    MessageSquare,
    Trash2,
    Send,
    Sparkles,
    Bot,
    User,
    Menu,
    X,
    BookOpen,
    Code2,
    Brain,
    ChevronRight
} from "lucide-react";

import "../App.css";
import { getAuthToken } from "../utils/authSession";


const API_BASE = import.meta.env.VITE_API_URL || "";


function Tutor() {

    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");

    const [loading, setLoading] = useState(false);
    const [loadingConversations, setLoadingConversations] = useState(true);

    const [sidebarOpen, setSidebarOpen] = useState(true);

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);


    // =========================================================
    // API REQUEST
    // =========================================================

    const tutorRequest = async (url, options = {}) => {

        const token = getAuthToken();

        const response = await fetch(
            `${API_BASE}${url}`,
            {
                ...options,

                headers: {
                    "Content-Type": "application/json",

                    ...(token
                        ? {
                            Authorization: `Bearer ${token}`
                        }
                        : {}),

                    ...(options.headers || {})
                }
            }
        );


        if (!response.ok) {

            let errorMessage =
                "Something went wrong.";

            try {

                const errorData =
                    await response.json();

                errorMessage =
                    errorData.message ||
                    errorData.error ||
                    errorMessage;

            } catch {
                // Ignore invalid error response
            }

            throw new Error(errorMessage);
        }


        return response.json();
    };


    // =========================================================
    // LOAD CONVERSATIONS
    // =========================================================

    const loadConversations = async () => {

        try {

            setLoadingConversations(true);

            const data =
                await tutorRequest(
                    "/api/tutor/conversations"
                );

            setConversations(
                Array.isArray(data)
                    ? data
                    : []
            );

        } catch (error) {

            console.error(
                "Failed to load conversations:",
                error
            );

        } finally {

            setLoadingConversations(false);
        }
    };


    useEffect(() => {

        loadConversations();

    }, []);


    // =========================================================
    // LOAD MESSAGES
    // =========================================================

    const loadMessages = async (
        conversationId
    ) => {

        try {

            setLoading(true);

            const data =
                await tutorRequest(
                    `/api/tutor/conversations/${conversationId}/messages`
                );

            setMessages(
                Array.isArray(data)
                    ? data
                    : []
            );

        } catch (error) {

            console.error(
                "Failed to load messages:",
                error
            );

            setMessages([]);

        } finally {

            setLoading(false);
        }
    };


    // =========================================================
    // SELECT CONVERSATION
    // =========================================================

    const selectConversation = async (
        conversation
    ) => {

        setActiveConversation(
            conversation
        );

        await loadMessages(
            conversation.id
        );

        if (window.innerWidth < 900) {
            setSidebarOpen(false);
        }
    };


    // =========================================================
    // NEW CHAT
    // =========================================================

    const createNewConversation = () => {

        setActiveConversation(null);

        setMessages([]);

        setInput("");

        if (window.innerWidth < 900) {
            setSidebarOpen(false);
        }

        setTimeout(() => {
            textareaRef.current?.focus();
        }, 100);
    };


    // =========================================================
    // DELETE CONVERSATION
    // =========================================================

    const deleteConversation = async (
        event,
        conversationId
    ) => {

        event.stopPropagation();

        const confirmed =
            window.confirm(
                "Delete this conversation?"
            );

        if (!confirmed) {
            return;
        }


        try {

            await tutorRequest(
                `/api/tutor/conversations/${conversationId}`,
                {
                    method: "DELETE"
                }
            );


            setConversations(
                previous =>
                    previous.filter(
                        conversation =>
                            conversation.id !==
                            conversationId
                    )
            );


            if (
                activeConversation &&
                activeConversation.id ===
                    conversationId
            ) {

                createNewConversation();
            }

        } catch (error) {

            console.error(
                "Failed to delete conversation:",
                error
            );

            alert(error.message);
        }
    };


    // =========================================================
    // SEND MESSAGE
    // =========================================================

    const sendMessage = async (
        messageText = input
    ) => {

        const trimmedMessage =
            messageText.trim();


        if (
            !trimmedMessage ||
            loading
        ) {
            return;
        }


        setInput("");

        let conversation =
            activeConversation;


        try {

            setLoading(true);


            // -------------------------------------------------
            // CREATE CONVERSATION
            // -------------------------------------------------

            if (!conversation) {

                conversation =
                    await tutorRequest(
                        "/api/tutor/conversations",
                        {
                            method: "POST",

                            body: JSON.stringify({
                                title:
                                    trimmedMessage.length > 45
                                        ? `${trimmedMessage.slice(
                                            0,
                                            45
                                        )}...`
                                        : trimmedMessage
                            })
                        }
                    );


                setActiveConversation(
                    conversation
                );


                setConversations(
                    previous => [
                        conversation,
                        ...previous
                    ]
                );
            }


            // -------------------------------------------------
            // SHOW USER MESSAGE
            // -------------------------------------------------

            const temporaryUserMessage = {

                id:
                    `temp-user-${Date.now()}`,

                role: "user",

                content:
                    trimmedMessage
            };


            setMessages(
                previous => [
                    ...previous,
                    temporaryUserMessage
                ]
            );


            // -------------------------------------------------
            // SEND TO BACKEND
            // -------------------------------------------------

            const response =
                await tutorRequest(
                    `/api/tutor/conversations/${conversation.id}/messages`,
                    {
                        method: "POST",

                        body: JSON.stringify({
                            message:
                                trimmedMessage
                        })
                    }
                );


            // -------------------------------------------------
            // ADD AI RESPONSE
            // -------------------------------------------------

            if (response) {

                if (
                    Array.isArray(response)
                ) {

                    setMessages(response);

                } else {

                    const assistantMessage =
                        response.assistantMessage ||
                        response.message ||
                        response;


                    setMessages(
                        previous => [
                            ...previous,
                            assistantMessage
                        ]
                    );
                }
            }

        } catch (error) {

            console.error(
                "Failed to send message:",
                error
            );


            setMessages(
                previous => [
                    ...previous,

                    {
                        id:
                            `error-${Date.now()}`,

                        role:
                            "assistant",

                        content:
                            "I couldn't process your message. Please try again."
                    }
                ]
            );

        } finally {

            setLoading(false);

            setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
        }
    };


    // =========================================================
    // ENTER KEY
    // =========================================================

    const handleKeyDown = event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();
        }
    };


    // =========================================================
    // AUTO SCROLL
    // =========================================================

    useEffect(() => {

        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth"
        });

    }, [messages, loading]);


    // =========================================================
    // FORMAT AI MESSAGE
    // =========================================================

    const formatMessage = content => {

        if (!content) {
            return null;
        }


        const lines =
            content.split("\n");

        const elements = [];

        let codeBlock = false;
        let codeLines = [];


        lines.forEach(
            (line, index) => {


                // ---------------------------------------------
                // CODE BLOCK
                // ---------------------------------------------

                if (
                    line
                        .trim()
                        .startsWith("```")
                ) {

                    if (!codeBlock) {

                        codeBlock = true;

                        codeLines = [];

                    } else {

                        codeBlock = false;


                        elements.push(
                            <pre
                                key={
                                    `code-${index}`
                                }
                                className="tutor-code-block"
                            >
                                <code>
                                    {
                                        codeLines.join(
                                            "\n"
                                        )
                                    }
                                </code>
                            </pre>
                        );
                    }

                    return;
                }


                if (codeBlock) {

                    codeLines.push(line);

                    return;
                }


                // ---------------------------------------------
                // EMPTY LINE
                // ---------------------------------------------

                if (!line.trim()) {

                    elements.push(
                        <div
                            key={
                                `space-${index}`
                            }
                            className="tutor-message-space"
                        />
                    );

                    return;
                }


                // ---------------------------------------------
                // HEADINGS
                // ---------------------------------------------

                if (
                    line.startsWith("### ")
                ) {

                    elements.push(
                        <h4 key={index}>
                            {
                                formatInline(
                                    line.replace(
                                        "### ",
                                        ""
                                    )
                                )
                            }
                        </h4>
                    );

                    return;
                }


                if (
                    line.startsWith("## ")
                ) {

                    elements.push(
                        <h3 key={index}>
                            {
                                formatInline(
                                    line.replace(
                                        "## ",
                                        ""
                                    )
                                )
                            }
                        </h3>
                    );

                    return;
                }


                if (
                    line.startsWith("# ")
                ) {

                    elements.push(
                        <h2 key={index}>
                            {
                                formatInline(
                                    line.replace(
                                        "# ",
                                        ""
                                    )
                                )
                            }
                        </h2>
                    );

                    return;
                }


                // ---------------------------------------------
                // BULLETS
                // ---------------------------------------------

                if (
                    line
                        .trim()
                        .startsWith("- ") ||
                    line
                        .trim()
                        .startsWith("* ")
                ) {

                    elements.push(
                        <div
                            key={index}
                            className="tutor-bullet"
                        >

                            <span>
                                •
                            </span>

                            <span>
                                {
                                    formatInline(
                                        line
                                            .trim()
                                            .substring(2)
                                    )
                                }
                            </span>

                        </div>
                    );

                    return;
                }


                // ---------------------------------------------
                // NUMBERED LIST
                // ---------------------------------------------

                const numberedMatch =
                    line
                        .trim()
                        .match(
                            /^(\d+)\.\s+(.*)$/
                        );


                if (numberedMatch) {

                    elements.push(
                        <div
                            key={index}
                            className="tutor-numbered"
                        >

                            <span>
                                {
                                    numberedMatch[1]
                                }.
                            </span>

                            <span>
                                {
                                    formatInline(
                                        numberedMatch[2]
                                    )
                                }
                            </span>

                        </div>
                    );

                    return;
                }


                // ---------------------------------------------
                // NORMAL TEXT
                // ---------------------------------------------

                elements.push(
                    <p key={index}>
                        {
                            formatInline(line)
                        }
                    </p>
                );
            }
        );


        return elements;
    };


    // =========================================================
    // INLINE FORMAT
    // =========================================================

    const formatInline = text => {

        const parts =
            text.split(
                /(`[^`]+`|\*\*[^*]+\*\*)/g
            );


        return parts.map(
            (part, index) => {

                // Inline code

                if (
                    part.startsWith("`") &&
                    part.endsWith("`")
                ) {

                    return (
                        <code
                            key={index}
                            className="tutor-inline-code"
                        >
                            {
                                part.slice(
                                    1,
                                    -1
                                )
                            }
                        </code>
                    );
                }


                // Bold

                if (
                    part.startsWith("**") &&
                    part.endsWith("**")
                ) {

                    return (
                        <strong
                            key={index}
                        >
                            {
                                part.slice(
                                    2,
                                    -2
                                )
                            }
                        </strong>
                    );
                }


                return part;
            }
        );
    };


    // =========================================================
    // SUGGESTIONS
    // =========================================================

    const suggestions = useMemo(
        () => [

            {
                icon:
                    <BookOpen size={20} />,

                title:
                    "Learn a concept",

                text:
                    "Teach me Java OOP step by step."
            },

            {
                icon:
                    <Code2 size={20} />,

                title:
                    "Practice coding",

                text:
                    "Give me an easy Java coding problem."
            },

            {
                icon:
                    <Brain size={20} />,

                title:
                    "Prepare for interview",

                text:
                    "Ask me Java interview questions."
            },

            {
                icon:
                    <Sparkles size={20} />,

                title:
                    "Understand better",

                text:
                    "Explain polymorphism in simple terms."
            }

        ],
        []
    );


    // =========================================================
    // UI
    // =========================================================

    return (

        <div className="tutor-page">


            {/* =================================================
                SIDEBAR
            ================================================= */}

            <aside
                className={
                    `tutor-sidebar ${
                        sidebarOpen
                            ? "tutor-sidebar-open"
                            : "tutor-sidebar-closed"
                    }`
                }
            >

                <div className="tutor-sidebar-header">

                    <div className="tutor-brand">

                        <div className="tutor-brand-icon">

                            <Sparkles size={20} />

                        </div>


                        <div>

                            <div className="tutor-brand-title">
                                AI Tutor
                            </div>

                            <div className="tutor-brand-subtitle">
                                Personalized learning
                            </div>

                        </div>

                    </div>


                    <button
                        className={
                            "tutor-icon-button " +
                            "tutor-mobile-close"
                        }
                        onClick={() =>
                            setSidebarOpen(false)
                        }
                    >
                        <X size={20} />
                    </button>

                </div>


                {/* NEW CONVERSATION */}

                <button
                    className="tutor-new-chat-button"
                    onClick={
                        createNewConversation
                    }
                >

                    <Plus size={19} />

                    <span>
                        New conversation
                    </span>

                </button>


                {/* CONVERSATIONS */}

                <div className="tutor-history">

                    <div className="tutor-history-label">
                        Recent conversations
                    </div>


                    {loadingConversations ? (

                        <div className="tutor-history-loading">
                            Loading conversations...
                        </div>

                    ) : conversations.length === 0 ? (

                        <div className="tutor-history-empty">

                            <MessageSquare
                                size={28}
                            />

                            <span>
                                No conversations yet
                            </span>

                        </div>

                    ) : (

                        conversations.map(
                            conversation => (

                                <button
                                    key={
                                        conversation.id
                                    }
                                    className={
                                        `tutor-conversation-item ${
                                            activeConversation?.id ===
                                            conversation.id
                                                ? "active"
                                                : ""
                                        }`
                                    }
                                    onClick={() =>
                                        selectConversation(
                                            conversation
                                        )
                                    }
                                >

                                    <MessageSquare
                                        size={17}
                                    />


                                    <span className="tutor-conversation-title">

                                        {
                                            conversation.title ||
                                            "New conversation"
                                        }

                                    </span>


                                    <span
                                        className="tutor-delete-button"
                                        onClick={
                                            event =>
                                                deleteConversation(
                                                    event,
                                                    conversation.id
                                                )
                                        }
                                    >

                                        <Trash2
                                            size={15}
                                        />

                                    </span>

                                </button>
                            )
                        )
                    )}

                </div>


                {/* STATUS */}

                <div className="tutor-sidebar-footer">

                    <div className="tutor-ai-status">

                        <span className="tutor-status-dot" />

                        <span>
                            AI Tutor Online
                        </span>

                    </div>

                </div>

            </aside>


            {/* =================================================
                MAIN
            ================================================= */}

            <main className="tutor-main">


                {/* HEADER */}

                <header className="tutor-header">

                    <div className="tutor-header-left">

                        <button
                            className={
                                "tutor-icon-button " +
                                "tutor-menu-button"
                            }
                            onClick={() =>
                                setSidebarOpen(
                                    !sidebarOpen
                                )
                            }
                        >

                            {sidebarOpen ? (
                                <X size={21} />
                            ) : (
                                <Menu size={21} />
                            )}

                        </button>


                        <div>

                            <h1>
                                {
                                    activeConversation?.title ||
                                    "AI Tutor"
                                }
                            </h1>

                            <p>
                                Learn, practice and improve
                            </p>

                        </div>

                    </div>


                    <div className="tutor-provider-badge">

                        <span className="tutor-provider-dot" />

                        Gemini + Groq

                    </div>

                </header>


                {/* =================================================
                    CHAT AREA
                ================================================= */}

                <section className="tutor-chat-area">


                    {/* WELCOME */}

                    {messages.length === 0 &&
                    !loading ? (

                        <div className="tutor-welcome">

                            <div className="tutor-welcome-icon">

                                <Bot size={34} />

                            </div>


                            <h2>
                                What do you want to learn?
                            </h2>


                            <p>
                                I am your personalized AI
                                tutor. Ask questions,
                                practice coding, prepare
                                for interviews, or learn a
                                new concept step by step.
                            </p>


                            <div className="tutor-suggestions">

                                {suggestions.map(
                                    suggestion => (

                                        <button
                                            key={
                                                suggestion.title
                                            }
                                            className={
                                                "tutor-suggestion-card"
                                            }
                                            onClick={() =>
                                                sendMessage(
                                                    suggestion.text
                                                )
                                            }
                                        >

                                            <div className="tutor-suggestion-icon">

                                                {
                                                    suggestion.icon
                                                }

                                            </div>


                                            <div className="tutor-suggestion-content">

                                                <strong>
                                                    {
                                                        suggestion.title
                                                    }
                                                </strong>

                                                <span>
                                                    {
                                                        suggestion.text
                                                    }
                                                </span>

                                            </div>


                                            <ChevronRight
                                                size={18}
                                            />

                                        </button>
                                    )
                                )}

                            </div>

                        </div>

                    ) : (

                        /* =================================================
                           MESSAGES
                        ================================================= */

                        <div className="tutor-messages">

                            {messages.map(
                                (
                                    message,
                                    index
                                ) => {

                                    const isUser =
                                        message.role ===
                                            "user" ||
                                        message.role ===
                                            "USER";


                                    return (

                                        <div
                                            key={
                                                message.id ||
                                                index
                                            }
                                            className={
                                                `tutor-message-row ${
                                                    isUser
                                                        ? "user"
                                                        : "assistant"
                                                }`
                                            }
                                        >

                                            <div className="tutor-message-avatar">

                                                {isUser ? (
                                                    <User
                                                        size={18}
                                                    />
                                                ) : (
                                                    <Bot
                                                        size={18}
                                                    />
                                                )}

                                            </div>


                                            <div className="tutor-message-content">

                                                <div className="tutor-message-name">

                                                    {isUser
                                                        ? "You"
                                                        : "AI Tutor"}

                                                </div>


                                                <div className="tutor-message-bubble">

                                                    {
                                                        formatMessage(
                                                            message.content ||
                                                            message.message ||
                                                            ""
                                                        )
                                                    }

                                                </div>

                                            </div>

                                        </div>
                                    );
                                }
                            )}


                            {/* AI THINKING */}

                            {loading && (

                                <div className="tutor-message-row assistant">

                                    <div className="tutor-message-avatar">

                                        <Bot size={18} />

                                    </div>


                                    <div className="tutor-message-content">

                                        <div className="tutor-message-name">
                                            AI Tutor
                                        </div>


                                        <div className="tutor-thinking">

                                            <span />
                                            <span />
                                            <span />

                                            <label>
                                                Thinking...
                                            </label>

                                        </div>

                                    </div>

                                </div>
                            )}


                            <div
                                ref={
                                    messagesEndRef
                                }
                            />

                        </div>
                    )}

                </section>


                {/* =================================================
                    MESSAGE COMPOSER
                ================================================= */}

                <div className="tutor-composer-wrapper">

                    <div className="tutor-composer">

                        <textarea
                            ref={
                                textareaRef
                            }
                            value={input}
                            onChange={
                                event =>
                                    setInput(
                                        event.target.value
                                    )
                            }
                            onKeyDown={
                                handleKeyDown
                            }
                            placeholder={
                                "Ask your AI tutor anything..."
                            }
                            rows={1}
                            disabled={loading}
                        />


                        <button
                            className="tutor-send-button"
                            onClick={() =>
                                sendMessage()
                            }
                            disabled={
                                loading ||
                                !input.trim()
                            }
                            aria-label="Send message"
                        >

                            <Send size={19} />

                        </button>

                    </div>


                    <div className="tutor-composer-hint">

                        <span>
                            Press Enter to send
                        </span>

                        <span>
                            Shift + Enter for a new line
                        </span>

                    </div>

                </div>

            </main>

        </div>
    );
}


export default Tutor;