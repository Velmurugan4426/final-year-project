package com.learningassistant.learning_assistant.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learningassistant.learning_assistant.dto.DashboardResponse;
import com.learningassistant.learning_assistant.dto.AnalyticsResponse;
import com.learningassistant.learning_assistant.entity.QuizAttempt;
import com.learningassistant.learning_assistant.entity.StudyPlan;
import com.learningassistant.learning_assistant.entity.StudyTask;
import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.repository.QuizAttemptRepository;
import com.learningassistant.learning_assistant.repository.StudyPlanRepository;
import com.learningassistant.learning_assistant.security.JwtService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class DashboardService {

    private final UserService userService;
    private final StudyPlanRepository planRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final JwtService jwtService;
    private final AnalyticsService analyticsService;
    private final ObjectMapper objectMapper = new ObjectMapper();


    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    public DashboardService(
            UserService userService,
            StudyPlanRepository planRepository,
            QuizAttemptRepository quizAttemptRepository,
            JwtService jwtService,
            AnalyticsService analyticsService
    ) {
        this.userService = userService;
        this.planRepository = planRepository;
        this.quizAttemptRepository = quizAttemptRepository;
        this.jwtService = jwtService;
        this.analyticsService = analyticsService;
    }


    // =========================================================
    // GET DASHBOARD
    // =========================================================

    @Transactional
    public DashboardResponse getDashboard(String authorization) {
        User user = authenticatedUser(authorization);
        List<StudyPlan> plans = planRepository.findByUserIdOrderByCreatedAtDesc(user.getId());

        long totalTasks = 0;
        long completedTasks = 0;
        long studyMinutes = 0;
        List<DashboardResponse.TaskItem> todayTasks = new ArrayList<>();
        List<DashboardResponse.TaskItem> upcomingTasks = new ArrayList<>();
        LocalDate today = LocalDate.now();
        String activeGoal = null;

        for (StudyPlan plan : plans) {
            if (activeGoal == null && !plan.getTargetDate().isBefore(today)) {
                activeGoal = plan.getGoal();
            }
            for (StudyTask task : plan.getTasks()) {
                totalTasks++;
                if (task.isCompleted()) {
                    completedTasks++;
                    studyMinutes += Math.max(0, task.getDurationMinutes());
                }
                DashboardResponse.TaskItem item = new DashboardResponse.TaskItem(
                        plan.getId(),
                        task.getId(),
                        task.getTitle(),
                        plan.getGoal(),
                        task.getSessionDate(),
                        task.getDurationMinutes(),
                        task.isCompleted()
                );
                if (today.equals(task.getSessionDate())) {
                    todayTasks.add(item);
                } else if (task.getSessionDate().isAfter(today) && !task.isCompleted()) {
                    upcomingTasks.add(item);
                }
            }
        }

        Comparator<DashboardResponse.TaskItem> taskOrder = Comparator
                .comparing(DashboardResponse.TaskItem::date)
                .thenComparing(DashboardResponse.TaskItem::title, String.CASE_INSENSITIVE_ORDER);
        todayTasks.sort(taskOrder);
        upcomingTasks.sort(taskOrder);
        upcomingTasks = upcomingTasks.stream().limit(5).toList();

        QuizAttemptRepository.QuizAttemptSummary quizSummary =
                quizAttemptRepository.getCompletedSummary(user.getId());
        List<QuizAttempt> recentAttempts =
                quizAttemptRepository.findTop5ByUserIdAndStatusOrderByCompletedAtDesc(user.getId(), "COMPLETED");
        List<DashboardResponse.RecentQuiz> recentQuizzes = recentAttempts.stream()
                .map(attempt -> new DashboardResponse.RecentQuiz(
                        attempt.getId(),
                        attempt.getTopic(),
                        attempt.getDifficulty(),
                        attempt.getScore(),
                        attempt.getCorrectCount(),
                        questionCount(attempt),
                        attempt.getCompletedAt()
                ))
                .toList();

        studyMinutes += quizSummary.getElapsedMinutes() == null
                ? 0
                : quizSummary.getElapsedMinutes().longValue();

        AnalyticsResponse weeklyAnalytics = analyticsService.getAnalytics(authorization, 7);
        AnalyticsResponse.Summary weekly = weeklyAnalytics.summary();
        int completionPercentage = totalTasks == 0
                ? 0
                : (int) Math.round(completedTasks * 100.0 / totalTasks);

        return new DashboardResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                totalTasks,
                completedTasks,
                totalTasks - completedTasks,
                completionPercentage,
                quizSummary.getCompletedCount(),
                quizSummary.getAverageScore() == null
                        ? 0
                        : Math.round(quizSummary.getAverageScore() * 10.0) / 10.0,
                Math.round(studyMinutes / 6.0) / 10.0,
                weekly.currentStreak(),
                weeklyAnalytics.activity().stream().mapToInt(AnalyticsResponse.DailyActivity::studyMinutes).sum(),
                activeGoal,
                todayTasks,
                upcomingTasks,
                recentQuizzes
        );
    }

    private User authenticatedUser(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to view your dashboard.");
        }
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty() || !jwtService.isTokenValid(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Your session is invalid or has expired.");
        }
        return userService.findByEmail(jwtService.extractEmail(token));
    }

    private int questionCount(QuizAttempt attempt) {
        try {
            return objectMapper.readTree(attempt.getQuestionsJson())
                    .size();
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not read saved quiz data for dashboard.", exception);
        }
    }
}