package com.learningassistant.learning_assistant.dto;

import java.time.LocalDateTime;
import java.util.List;

public record QuizAttemptResponse(
        Long id,
        String topic,
        String difficulty,
        int timeLimitMinutes,
        Integer elapsedSeconds,
        Integer score,
        Integer correctCount,
        String status,
        String generationSource,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        List<QuizQuestionResponse> questions,
        List<QuizWeakAreaResponse> weakAreas
) {
}
