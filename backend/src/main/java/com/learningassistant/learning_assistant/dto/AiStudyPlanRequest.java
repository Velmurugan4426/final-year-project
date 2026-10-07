package com.learningassistant.learning_assistant.dto;

import java.time.LocalDate;
import java.util.List;

public record AiStudyPlanRequest(
        String goal,
        List<String> topics,
        String currentLevel,
        int dailyMinutes,
        LocalDate targetDate,
        String priority
) {
}