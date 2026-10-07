package com.learningassistant.learning_assistant.dto;

import java.time.LocalDateTime;

public record TutorMessageResponse(
        Long id,
        String role,
        String content,
        LocalDateTime createdAt
) {
}
