package com.learningassistant.learning_assistant.dto;

public class DashboardResponse {

    private Long userId;
    private String name;
    private String email;

    private long totalTasks;
    private long completedTasks;
    private long pendingTasks;

    private int completionPercentage;

    private long totalQuizAttempts;
    private double averageQuizScore;

    private double totalStudyHours;


    public DashboardResponse() {
    }


    public DashboardResponse(
            Long userId,
            String name,
            String email,
            long totalTasks,
            long completedTasks,
            long pendingTasks,
            int completionPercentage,
            long totalQuizAttempts,
            double averageQuizScore,
            double totalStudyHours
    ) {
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.totalTasks = totalTasks;
        this.completedTasks = completedTasks;
        this.pendingTasks = pendingTasks;
        this.completionPercentage = completionPercentage;
        this.totalQuizAttempts = totalQuizAttempts;
        this.averageQuizScore = averageQuizScore;
        this.totalStudyHours = totalStudyHours;
    }


    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }


    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }


    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }


    public long getTotalTasks() {
        return totalTasks;
    }

    public void setTotalTasks(long totalTasks) {
        this.totalTasks = totalTasks;
    }


    public long getCompletedTasks() {
        return completedTasks;
    }

    public void setCompletedTasks(long completedTasks) {
        this.completedTasks = completedTasks;
    }


    public long getPendingTasks() {
        return pendingTasks;
    }

    public void setPendingTasks(long pendingTasks) {
        this.pendingTasks = pendingTasks;
    }


    public int getCompletionPercentage() {
        return completionPercentage;
    }

    public void setCompletionPercentage(int completionPercentage) {
        this.completionPercentage = completionPercentage;
    }


    public long getTotalQuizAttempts() {
        return totalQuizAttempts;
    }

    public void setTotalQuizAttempts(long totalQuizAttempts) {
        this.totalQuizAttempts = totalQuizAttempts;
    }


    public double getAverageQuizScore() {
        return averageQuizScore;
    }

    public void setAverageQuizScore(double averageQuizScore) {
        this.averageQuizScore = averageQuizScore;
    }


    public double getTotalStudyHours() {
        return totalStudyHours;
    }

    public void setTotalStudyHours(double totalStudyHours) {
        this.totalStudyHours = totalStudyHours;
    }
}