import assert from "node:assert/strict";
import test from "node:test";
import {
    createEmptyQuizAnswers,
    isQuizAnswerCorrect,
    recordQuizAnswer
} from "./quizState.js";

test("new quiz answers start unanswered", () => {
    assert.deepEqual(createEmptyQuizAnswers(5), [-1, -1, -1, -1, -1]);
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
