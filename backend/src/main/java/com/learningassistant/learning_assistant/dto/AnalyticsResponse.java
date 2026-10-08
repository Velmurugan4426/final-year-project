package com.learningassistant.learning_assistant.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record AnalyticsResponse(
        int rangeDays,
        LocalDate fromDate,
        LocalDate toDate,
        LocalDateTime generatedAt,
        Summary summary,
        List<DailyActivity> activity,
        List<TopicPerformance> topics,
        List<SkillPerformance> skills,
        List<RecentAttempt> recentAttempts
) {
    public record Summary(
            long totalTasks,
            long completedTasks,
            long pendingTasks,
            int completionPercentage,
            long completedQuizzes,
            double averageQuizScore,
            double studyHours,
            int activeDays,
            int currentStreak,
            int bestStreak
    ) {
    }

    public record DailyActivity(
            LocalDate date,
            int completedTasks,
            int completedQuizzes,
            int studyMinutes,
            Integer averageQuizScore
    ) {
    }

    public record TopicPerformance(
            String topic,
            int correctAnswers,
            int attemptedQuestions,
            int accuracy
    ) {
    }

    public record SkillPerformance(
            String skill,
            int correctAnswers,
            int attemptedQuestions,
            int accuracy
    ) {
    }

    public record RecentAttempt(
            Long id,
            String topic,
            String difficulty,
            int score,
            int correctAnswers,
            int questionCount,
            LocalDateTime completedAt
    ) {
    }
}
