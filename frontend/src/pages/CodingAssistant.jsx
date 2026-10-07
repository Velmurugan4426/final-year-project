function CodingAssistant() {
    return (
        <div className="feature-page">
            <p className="eyebrow">CODING ASSISTANCE</p>
            <h1>Coding Assistant</h1>
            <p>
                Get coding guidance, debugging assistance, explanations,
                and personalized feedback.
            </p>

            <div className="coding-panel">
                <textarea
                    className="code-input"
                    placeholder="Write or paste your code here..."
                    rows="12"
                />

                <button className="primary-button">
                    Analyze Code
                </button>
            </div>
        </div>
    );
}

export default CodingAssistant;