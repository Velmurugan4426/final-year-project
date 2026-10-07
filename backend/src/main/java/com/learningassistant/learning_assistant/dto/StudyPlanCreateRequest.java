package com.learningassistant.learning_assistant.dto;

import java.time.LocalDate;
import java.util.List;

public record StudyPlanCreateRequest(
        String goal,
        LocalDate targetDate,
        int dailyMinutes,
        List<TaskInput> tasks
) {
    public record TaskInput(
            LocalDate date,
            String title,
            int durationMinutes
    ) {
    }
}
