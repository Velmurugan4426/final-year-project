package com.learningassistant.learning_assistant.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learningassistant.learning_assistant.dto.AnalyticsResponse;
import com.learningassistant.learning_assistant.entity.QuizAttempt;
import com.learningassistant.learning_assistant.entity.StudyPlan;
import com.learningassistant.learning_assistant.entity.StudyTask;
import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.repository.QuizAttemptRepository;
import com.learningassistant.learning_assistant.repository.StudyPlanRepository;
import com.learningassistant.learning_assistant.repository.UserRepository;
import com.learningassistant.learning_assistant.security.JwtService;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class AnalyticsService {

    private static final Logger logger = LoggerFactory.getLogger(AnalyticsService.class);
    private static final Set<Integer> ALLOWED_RANGES = Set.of(7, 30, 90);

    private final StudyPlanRepository planRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AnalyticsService(
            StudyPlanRepository planRepository,
            QuizAttemptRepository quizAttemptRepository,
            UserRepository userRepository,
            JwtService jwtService
    ) {
        this.planRepository = planRepository;
        this.quizAttemptRepository = quizAttemptRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    @Transactional
    public AnalyticsResponse getAnalytics(String authorization, Integer requestedDays) {
        User user = authenticatedUser(authorization);
        int days = requestedDays == null ? 30 : requestedDays;
        if (!ALLOWED_RANGES.contains(days)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Choose an analytics range of 7, 30, or 90 days."
            );
        }

        LocalDate today = LocalDate.now();
        LocalDate fromDate = today.minusDays(days - 1L);
        Map<LocalDate, DailyAccumulator> daily = new HashMap<>();
        for (int offset = 0; offset < days; offset++) {
            daily.put(fromDate.plusDays(offset), new DailyAccumulator());
        }

        long totalTasks = 0;
        long completedTasks = 0;
        double studyMinutes = 0;
        List<StudyPlan> plans = planRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        for (StudyPlan plan : plans) {
            for (StudyTask task : plan.getTasks()) {
                LocalDate date = task.getSessionDate();
                if (date == null || date.isBefore(fromDate) || date.isAfter(today)) {
                    continue;
                }
                totalTasks++;
                if (task.isCompleted()) {
                    completedTasks++;
                    studyMinutes += Math.max(0, task.getDurationMinutes());
                    daily.get(date).completedTasks++;
                    daily.get(date).studyMinutes += Math.max(0, task.getDurationMinutes());
                }
            }
        }

        Map<String, PerformanceAccumulator> topicTotals = new HashMap<>();
        Map<String, PerformanceAccumulator> skillTotals = new HashMap<>();
        List<QuizAttempt> completedAttempts = new ArrayList<>();
        List<AnalyticsResponse.RecentAttempt> recentAttempts = new ArrayList<>();
        long scoreTotal = 0;
        int scoreCount = 0;

        for (QuizAttempt attempt : quizAttemptRepository.findCompletedBetween(
                user.getId(),
                fromDate.atStartOfDay(),
                today.plusDays(1).atStartOfDay()
        )) {
            List<QuestionResult> questions = readQuestionResults(attempt);
            if (questions.isEmpty()) {
                continue;
            }

            Integer storedScore = attempt.getScore();
            int attemptScore = storedScore != null ? storedScore : 0;
            completedAttempts.add(attempt);
            LocalDate completedDate = attempt.getCompletedAt().toLocalDate();
            DailyAccumulator day = daily.get(completedDate);
            if (day != null) {
                day.completedQuizzes++;
                day.quizScoreTotal += attemptScore;
                day.quizScoreCount++;
            }

            int correctCount = 0;
            int answeredCount = 0;
            for (QuestionResult result : questions) {
                if (result.selectedOption() == null) {
                    continue;
                }
                answeredCount++;
                PerformanceAccumulator topic = topicTotals.computeIfAbsent(
                        attempt.getTopic(), ignored -> new PerformanceAccumulator()
                );
                topic.attempted++;
                PerformanceAccumulator skill = skillTotals.computeIfAbsent(
                        result.skill(), ignored -> new PerformanceAccumulator()
                );
                skill.attempted++;
                if (result.selectedOption().equals(result.correctOption())) {
                    correctCount++;
                    topic.correct++;
                    skill.correct++;
                }
            }
            if (day != null) {
                int elapsedMinutes = attempt.getElapsedSeconds() == null
                        ? 0
                        : Math.max(0, (int) Math.ceil(attempt.getElapsedSeconds() / 60.0));
                day.studyMinutes += elapsedMinutes;
                studyMinutes += elapsedMinutes;
            }

            if (attempt.getScore() != null) {
                scoreTotal += attemptScore;
                scoreCount++;
                Integer storedCorrectCount = attempt.getCorrectCount();
                int recentCorrectCount = storedCorrectCount != null
                        ? storedCorrectCount
                        : correctCount;
                recentAttempts.add(new AnalyticsResponse.RecentAttempt(
                        attempt.getId(),
                        attempt.getTopic(),
                        attempt.getDifficulty(),
                        attemptScore,
                        recentCorrectCount,
                        questions.size(),
                        attempt.getCompletedAt()
                ));
            }
        }

        List<AnalyticsResponse.DailyActivity> activity = daily.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> {
                    DailyAccumulator value = entry.getValue();
                    Integer average = value.quizScoreCount == 0
                            ? null
                            : (int) Math.round(value.quizScoreTotal / (double) value.quizScoreCount);
                    return new AnalyticsResponse.DailyActivity(
                            entry.getKey(),
                            value.completedTasks,
                            value.completedQuizzes,
                            value.studyMinutes,
                            average
                    );
                })
                .toList();

        List<AnalyticsResponse.TopicPerformance> topics = topicTotals.entrySet().stream()
                .map(entry -> new AnalyticsResponse.TopicPerformance(
                        entry.getKey(),
                        entry.getValue().correct,
                        entry.getValue().attempted,
                        percentage(entry.getValue())
                ))
                .sorted(Comparator.comparingInt(AnalyticsResponse.TopicPerformance::accuracy)
                        .thenComparing(AnalyticsResponse.TopicPerformance::topic))
                .toList();

        List<AnalyticsResponse.SkillPerformance> skills = skillTotals.entrySet().stream()
                .map(entry -> new AnalyticsResponse.SkillPerformance(
                        entry.getKey(),
                        entry.getValue().correct,
                        entry.getValue().attempted,
                        percentage(entry.getValue())
                ))
                .sorted(Comparator.comparingInt(AnalyticsResponse.SkillPerformance::accuracy)
                        .thenComparing(AnalyticsResponse.SkillPerformance::skill))
                .toList();

        long pendingTasks = totalTasks - completedTasks;
        int completionPercentage = totalTasks == 0
                ? 0
                : (int) Math.round(completedTasks * 100.0 / totalTasks);
        Set<LocalDate> activeDates = new HashSet<>();
        for (AnalyticsResponse.DailyActivity day : activity) {
            if (day.completedTasks() > 0 || day.completedQuizzes() > 0) {
                activeDates.add(day.date());
            }
        }

        int[] streaks = calculateStreaks(activeDates, today);
        AnalyticsResponse.Summary summary = new AnalyticsResponse.Summary(
                totalTasks,
                completedTasks,
                pendingTasks,
                completionPercentage,
                completedAttempts.size(),
                scoreCount == 0 ? 0 : Math.round(scoreTotal * 100.0 / scoreCount) / 100.0,
                Math.round(studyMinutes / 60.0 * 100.0) / 100.0,
                activeDates.size(),
                streaks[0],
                streaks[1]
        );

        return new AnalyticsResponse(
                days,
                fromDate,
                today,
                LocalDateTime.now(),
                summary,
                activity,
                topics,
                skills,
                recentAttempts.stream()
                        .sorted(Comparator.comparing(
                                AnalyticsResponse.RecentAttempt::completedAt,
                                Comparator.reverseOrder()
                        ))
                        .limit(8)
                        .toList()
        );
    }

    private List<QuestionResult> readQuestionResults(QuizAttempt attempt) {
        try {
            JsonNode questions = objectMapper.readTree(attempt.getQuestionsJson());
            if (!questions.isArray()) {
                throw new IOException("Stored quiz question data is not an array.");
            }
            List<QuestionResult> results = new ArrayList<>();
            for (JsonNode question : questions) {
                JsonNode correct = question.path("correctOption");
                JsonNode selected = question.path("selectedOption");
                if (!correct.canConvertToInt()) {
                    continue;
                }
                results.add(new QuestionResult(
                        correct.intValue(),
                        selected.canConvertToInt() ? selected.intValue() : null,
                        question.path("skill").asText("Other").trim().isBlank()
                                ? "Other"
                                : question.path("skill").asText("Other").trim()
                ));
            }
            return results;
        } catch (IOException exception) {
            logger.error("Could not read quiz analytics for attempt {}", attempt.getId(), exception);
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to calculate quiz analytics."
            );
        }
    }

    private int percentage(PerformanceAccumulator value) {
        return value.attempted == 0 ? 0 : (int) Math.round(value.correct * 100.0 / value.attempted);
    }

    private int[] calculateStreaks(Set<LocalDate> activeDates, LocalDate today) {
        int current = 0;
        LocalDate cursor = today;
        if (!activeDates.contains(cursor)) {
            cursor = cursor.minusDays(1);
        }
        while (activeDates.contains(cursor)) {
            current++;
            cursor = cursor.minusDays(1);
        }

        int best = 0;
        int running = 0;
        LocalDate previous = null;
        for (LocalDate date : activeDates.stream().sorted().toList()) {
            if (previous != null && ChronoUnit.DAYS.between(previous, date) == 1) {
                running++;
            } else {
                running = 1;
            }
            best = Math.max(best, running);
            previous = date;
        }
        return new int[]{current, best};
    }

    private User authenticatedUser(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to view your analytics.");
        }
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty() || !jwtService.isTokenValid(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Your session has expired. Please sign in again.");
        }
        String email = jwtService.extractEmail(token);
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Please sign in to view your analytics."
                ));
    }

    private static final class DailyAccumulator {
        private int completedTasks;
        private int completedQuizzes;
        private int studyMinutes;
        private long quizScoreTotal;
        private int quizScoreCount;
    }

    private static final class PerformanceAccumulator {
        private int correct;
        private int attempted;
    }

    private record QuestionResult(int correctOption, Integer selectedOption, String skill) {
    }
}
