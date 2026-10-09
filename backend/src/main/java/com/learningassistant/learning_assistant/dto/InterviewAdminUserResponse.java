package com.learningassistant.learning_assistant.dto;

import java.time.LocalDateTime;

public record InterviewAdminUserResponse(
        Long userId,
        String name,
        String email,
        boolean hasAccess,
        LocalDateTime accessExpiresAt,
        String accessSource,
        LocalDateTime adminGrantExpiresAt
) {
}
