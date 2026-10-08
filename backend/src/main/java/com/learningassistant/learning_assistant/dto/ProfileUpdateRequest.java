package com.learningassistant.learning_assistant.dto;

public record ProfileUpdateRequest(
        String name,
        String email,
        String learningGoal,
        String targetRole,
        String experienceLevel
) {
}
