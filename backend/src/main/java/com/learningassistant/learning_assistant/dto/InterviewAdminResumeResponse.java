package com.learningassistant.learning_assistant.dto;

import java.time.LocalDateTime;

public record InterviewAdminResumeResponse(
        Long userId,
        String userName,
        String userEmail,
        String fileName,
        LocalDateTime uploadedAt
) {
}
