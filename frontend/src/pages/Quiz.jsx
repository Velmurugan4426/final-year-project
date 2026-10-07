function Quiz() {
    return (
        <div className="feature-page">
            <p className="eyebrow">ASSESSMENT</p>
            <h1>Quiz & Assessment</h1>
            <p>
                Test your understanding with personalized quizzes based on
                your learning progress.
            </p>

            <div className="quiz-card">
                <h2>Select a Topic</h2>

                <div className="quiz-options">
                    <button>Java</button>
                    <button>SQL</button>
                    <button>Data Structures</button>
                    <button>DBMS</button>
                </div>

                <button className="primary-button">
                    Generate Quiz
                </button>
            </div>
        </div>
    );
}

export default Quiz;