package com.learningassistant.learning_assistant.dto;

public record PasswordChangeRequest(
        String currentPassword,
        String newPassword
) {
}
