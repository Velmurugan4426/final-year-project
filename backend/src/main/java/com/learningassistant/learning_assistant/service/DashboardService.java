package com.learningassistant.learning_assistant.service;

import com.learningassistant.learning_assistant.dto.DashboardResponse;
import com.learningassistant.learning_assistant.entity.User;

import org.springframework.stereotype.Service;

@Service
public class DashboardService {

    private final UserService userService;


    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    public DashboardService(UserService userService) {
        this.userService = userService;
    }


    // =========================================================
    // GET DASHBOARD
    // =========================================================

    public DashboardResponse getDashboard(String email) {

        User user = userService.findByEmail(email);

        long totalTasks = 0;
        long completedTasks = 0;
        long pendingTasks = 0;

        int completionPercentage = 0;

        long totalQuizAttempts = 0;
        double averageQuizScore = 0.0;

        double totalStudyHours = 0.0;


        return new DashboardResponse(

                user.getId(),

                user.getName(),

                user.getEmail(),

                totalTasks,

                completedTasks,

                pendingTasks,

                completionPercentage,

                totalQuizAttempts,

                averageQuizScore,

                totalStudyHours
        );
    }
}