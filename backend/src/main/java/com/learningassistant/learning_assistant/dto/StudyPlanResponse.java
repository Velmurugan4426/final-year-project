package com.learningassistant.learning_assistant.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record StudyPlanResponse(
        Long id,
        String goal,
        LocalDate targetDate,
        int dailyMinutes,
        LocalDateTime createdAt,
        List<TaskResponse> tasks
) {
    public record TaskResponse(
            Long id,
            LocalDate date,
            String title,
            int durationMinutes,
            boolean completed
    ) {
    }
}
