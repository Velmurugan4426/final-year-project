package com.learningassistant.learning_assistant;

import com.learningassistant.learning_assistant.dto.QuizAttemptResponse;
import com.learningassistant.learning_assistant.dto.QuizStartRequest;
import com.learningassistant.learning_assistant.dto.QuizSubmitRequest;
import com.learningassistant.learning_assistant.dto.AnalyticsResponse;
import com.learningassistant.learning_assistant.entity.StudyPlan;
import com.learningassistant.learning_assistant.entity.StudyTask;
import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.repository.StudyPlanRepository;
import com.learningassistant.learning_assistant.repository.UserRepository;
import com.learningassistant.learning_assistant.service.AnalyticsService;
import com.learningassistant.learning_assistant.security.JwtService;
import com.learningassistant.learning_assistant.service.QuizService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:quiz-tests;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "gemini.api-key=",
        "grok.api-key=",
        "groq.api-key=",
        "app.jwt.secret=test-only-secret-with-at-least-32-characters"
})
class QuizServiceIntegrationTests {

    @Autowired
    private QuizService quizService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AnalyticsService analyticsService;

    @Autowired
    private StudyPlanRepository studyPlanRepository;

    @Test
    void analyticsAreScopedToUserAndReflectCompletedLearningActivity() {
        User user = createUser("analytics-learner@example.com");
        User otherUser = createUser("analytics-other@example.com");
        String token = "Bearer " + jwtService.generateToken(user.getEmail());
        saveStudyPlan(user, "Algorithms practice", 45);
        saveStudyPlan(otherUser, "Other user's practice", 90);

        QuizAttemptResponse quiz = quizService.start(
                token,
                new QuizStartRequest("Java", "Easy", 5, 10)
        );
        quizService.submit(token, quiz.id(), new QuizSubmitRequest(List.of(0, 0, 0, 0, 0)));

        AnalyticsResponse analytics = analyticsService.getAnalytics(token, 7);

        assertEquals(7, analytics.rangeDays());
        assertEquals(1, analytics.summary().totalTasks());
        assertEquals(1, analytics.summary().completedTasks());
        assertEquals(100, analytics.summary().completionPercentage());
        assertEquals(1, analytics.summary().completedQuizzes());
        assertEquals(0.75, analytics.summary().studyHours());
        assertEquals(1, analytics.summary().activeDays());
        assertEquals(1, analytics.topics().size());
        assertEquals("Java", analytics.topics().getFirst().topic());
        assertEquals(5, analytics.topics().getFirst().attemptedQuestions());
        assertEquals(7, analytics.activity().size());
    }

    @Test
    void createsSubmitsAndReviewsPersistedFallbackQuiz() {
        User user = createUser("quiz-learner@example.com");
        String token = "Bearer " + jwtService.generateToken(user.getEmail());

        QuizAttemptResponse started = quizService.start(
                token,
                new QuizStartRequest("Data Structures & Algorithms", "Medium", 5, 10)
        );

        assertEquals("IN_PROGRESS", started.status());
        assertEquals(5, started.questions().size());
        assertEquals("Question bank fallback", started.generationSource());
        assertTrue(started.questions().stream().allMatch(question -> question.correctOption() == null));

        QuizAttemptResponse submitted = quizService.submit(
                token,
                started.id(),
                new QuizSubmitRequest(List.of(0, 1, 2, 3, 0))
        );

        assertEquals("COMPLETED", submitted.status());
        assertNotNull(submitted.score());
        assertEquals(5, submitted.questions().size());
        assertTrue(submitted.questions().stream().allMatch(question -> question.correctOption() != null));
        assertFalse(submitted.weakAreas().isEmpty());
        assertEquals(1, quizService.history(token).size());
        assertEquals(submitted.score(), quizService.getAttempt(token, started.id()).score());
        assertFalse(quizService.weakAreas(token).isEmpty());
    }

    @Test
    void rejectsAttemptAccessFromAnotherUser() {
        User owner = createUser("quiz-owner@example.com");
        User other = createUser("quiz-other@example.com");
        String ownerToken = "Bearer " + jwtService.generateToken(owner.getEmail());
        String otherToken = "Bearer " + jwtService.generateToken(other.getEmail());
        QuizAttemptResponse started = quizService.start(
                ownerToken,
                new QuizStartRequest("Java", "Easy", 5, 10)
        );

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> quizService.getAttempt(otherToken, started.id())
        );

        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    private User createUser(String email) {
        User user = new User();
        user.setName("Quiz learner");
        user.setEmail(email);
        user.setPassword("test-password");
        return userRepository.save(user);
    }

    private void saveStudyPlan(User user, String goal, int minutes) {
        StudyPlan plan = new StudyPlan();
        plan.setUser(user);
        plan.setGoal(goal);
        plan.setTargetDate(LocalDate.now().plusDays(7));
        plan.setDailyMinutes(60);
        StudyTask task = new StudyTask();
        task.setSessionDate(LocalDate.now());
        task.setTitle(goal);
        task.setDurationMinutes(minutes);
        task.setCompleted(true);
        plan.addTask(task);
        studyPlanRepository.save(plan);
    }
}
