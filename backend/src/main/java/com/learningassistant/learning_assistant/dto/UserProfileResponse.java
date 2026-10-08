package com.learningassistant.learning_assistant.dto;

import java.time.LocalDateTime;

public record UserProfileResponse(
        Long userId,
        String name,
        String email,
        String learningGoal,
        String targetRole,
        String experienceLevel,
        LocalDateTime createdAt
) {
}
