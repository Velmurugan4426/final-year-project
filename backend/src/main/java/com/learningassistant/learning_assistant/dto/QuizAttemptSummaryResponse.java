package com.learningassistant.learning_assistant.dto;

import java.time.LocalDateTime;

public record QuizAttemptSummaryResponse(
        Long id,
        String topic,
        String difficulty,
        int questionCount,
        int timeLimitMinutes,
        Integer elapsedSeconds,
        Integer score,
        Integer correctCount,
        String status,
        String generationSource,
        LocalDateTime startedAt,
        LocalDateTime completedAt
) {
}
