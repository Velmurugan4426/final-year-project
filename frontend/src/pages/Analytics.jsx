function Analytics() {
    return (
        <div className="feature-page">
            <p className="eyebrow">LEARNING ANALYTICS</p>
            <h1>Learning Analytics</h1>
            <p>
                Track learning progress, strengths, weaknesses, study habits,
                and improvement over time.
            </p>

            <div className="analytics-grid">
                <div className="analytics-card">
                    <span>Overall Progress</span>
                    <strong>68%</strong>
                </div>

                <div className="analytics-card">
                    <span>Average Quiz Score</span>
                    <strong>82%</strong>
                </div>

                <div className="analytics-card">
                    <span>Study Hours</span>
                    <strong>12.5</strong>
                </div>

                <div className="analytics-card">
                    <span>Topics Completed</span>
                    <strong>24</strong>
                </div>
            </div>
        </div>
    );
}

export default Analytics;