package com.learningassistant.learning_assistant.dto;

public record QuizWeakAreaResponse(
        String skill,
        int correct,
        int attempted,
        int accuracy,
        String recommendation
) {
}
