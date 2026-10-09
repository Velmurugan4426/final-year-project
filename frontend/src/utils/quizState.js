export function createEmptyQuizAnswers(questionCount) {
    return Array(questionCount).fill(-1);
}

export function prepareNewQuiz(quiz) {
    return {
        ...quiz,
        status: "IN_PROGRESS",
        elapsedSeconds: quiz.elapsedSeconds ?? 0,
        score: null,
        correctCount: null,
        completedAt: null,
        questions: quiz.questions.map((question) => ({
            ...question,
            selectedOption: null,
            correctOption: null,
            explanation: ""
        }))
    };
}

export function recordQuizAnswer(answers, questionIndex, optionIndex) {
    return answers.map((answer, index) => index === questionIndex ? optionIndex : answer);
}

export function isQuizAnswerCorrect(selectedOption, correctOption) {
    return selectedOption != null
        && correctOption != null
        && selectedOption === correctOption;
}
