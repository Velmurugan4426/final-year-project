package com.learningassistant.learning_assistant.dto;

public record QuizStartRequest(
        String topic,
        String difficulty,
        Integer questionCount,
        Integer timeLimitMinutes
) {
}
