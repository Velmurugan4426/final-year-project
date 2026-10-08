package com.learningassistant.learning_assistant.dto;

import java.util.List;

public record QuizQuestionResponse(
        int number,
        String question,
        List<String> options,
        String skill,
        String difficulty,
        Integer selectedOption,
        Integer correctOption,
        String explanation
) {
}
