package com.learningassistant.learning_assistant.dto;

import java.time.LocalDateTime;

public record TutorConversationResponse(
        Long id,
        String title,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
