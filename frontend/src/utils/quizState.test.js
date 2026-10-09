import assert from "node:assert/strict";
import test from "node:test";
import {
    createEmptyQuizAnswers,
    isQuizAnswerCorrect,
    prepareNewQuiz,
    recordQuizAnswer
} from "./quizState.js";

test("new quiz answers start unanswered", () => {
    assert.deepEqual(createEmptyQuizAnswers(5), [-1, -1, -1, -1, -1]);
});

test("new quiz is treated as in progress and strips any answer or result data", () => {
    const sourceQuiz = {
        status: "COMPLETED",
        elapsedSeconds: 2,
        score: 100,
        correctCount: 1,
        completedAt: "2026-10-09T12:00:00",
        questions: [{
            selectedOption: 1,
            correctOption: 1,
            explanation: "Shown only after submission."
        }]
    };

    const quiz = prepareNewQuiz(sourceQuiz);

    assert.equal(quiz.status, "IN_PROGRESS");
    assert.equal(quiz.elapsedSeconds, 2);
    assert.equal(quiz.score, null);
    assert.equal(quiz.correctCount, null);
    assert.equal(quiz.completedAt, null);
    assert.deepEqual(quiz.questions[0], {
        selectedOption: null,
        correctOption: null,
        explanation: ""
    });
    assert.equal(sourceQuiz.questions[0].correctOption, 1);
});

test("recording an option changes only that question's selection", () => {
    const answers = createEmptyQuizAnswers(3);
    const updated = recordQuizAnswer(answers, 1, 2);

    assert.deepEqual(updated, [-1, 2, -1]);
    assert.deepEqual(answers, [-1, -1, -1]);
});

test("unanswered answers are never considered correct", () => {
    assert.equal(isQuizAnswerCorrect(null, null), false);
    assert.equal(isQuizAnswerCorrect(-1, 0), false);
    assert.equal(isQuizAnswerCorrect(0, 0), true);
    assert.equal(isQuizAnswerCorrect(1, 0), false);
});
