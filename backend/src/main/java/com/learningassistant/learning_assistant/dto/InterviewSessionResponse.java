package com.learningassistant.learning_assistant.dto;

import java.time.LocalDateTime;
import java.util.List;

public record InterviewSessionResponse(
        Long id,
        String jobRole,
        String interviewMode,
        String difficulty,
        String status,
        int questionCount,
        String currentQuestion,
        List<Turn> transcript,
        String feedback,
        String terminationReason,
        LocalDateTime createdAt,
        LocalDateTime startedAt,
        LocalDateTime expiresAt,
        LocalDateTime lastHeartbeatAt,
        long remainingSeconds,
        long durationSeconds,
        LocalDateTime completedAt,
        long revision
) {
    public record Turn(String question, String answer, String feedback, String status) {
    }
}
