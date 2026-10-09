package com.learningassistant.learning_assistant.dto;

import java.time.LocalDateTime;
import java.util.List;

public record InterviewAdminReportResponse(
        Long sessionId,
        Long userId,
        String userEmail,
        String jobRole,
        String interviewMode,
        String status,
        LocalDateTime createdAt,
        long durationSeconds,
        List<Flag> flags
) {
    public record Flag(String eventType, String details, String occurredAt) {
    }
}
