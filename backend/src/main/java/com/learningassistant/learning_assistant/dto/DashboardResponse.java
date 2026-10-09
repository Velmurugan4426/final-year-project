package com.learningassistant.learning_assistant.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record DashboardResponse(
        Long userId,
        String name,
        String email,
        long totalTasks,
        long completedTasks,
        long pendingTasks,
        int completionPercentage,
        long totalQuizAttempts,
        double averageQuizScore,
        double totalStudyHours,
        int currentStreak,
        int weeklyStudyMinutes,
        String activeGoal,
        List<TaskItem> todayTasks,
        List<TaskItem> upcomingTasks,
        List<RecentQuiz> recentQuizzes
) {
    public record TaskItem(
            Long planId,
            Long taskId,
            String title,
            String goal,
            LocalDate date,
            int durationMinutes,
            boolean completed
    ) {
    }

    public record RecentQuiz(
            Long id,
            String topic,
            String difficulty,
            Integer score,
            Integer correctCount,
            int questionCount,
            LocalDateTime completedAt
    ) {
    }
}
