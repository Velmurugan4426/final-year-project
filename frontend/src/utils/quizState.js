export function createEmptyQuizAnswers(questionCount) {
    return Array(questionCount).fill(-1);
}

export function recordQuizAnswer(answers, questionIndex, optionIndex) {
    return answers.map((answer, index) => index === questionIndex ? optionIndex : answer);
}

export function isQuizAnswerCorrect(selectedOption, correctOption) {
    return selectedOption != null
        && correctOption != null
        && selectedOption === correctOption;
}
