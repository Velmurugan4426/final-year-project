package com.learningassistant.learning_assistant.dto;

public record ProfileUpdateResponse(
        UserProfileResponse profile,
        String token
) {
}
