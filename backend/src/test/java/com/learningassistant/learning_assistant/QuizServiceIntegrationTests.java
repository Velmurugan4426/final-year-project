package com.learningassistant.learning_assistant;

import com.learningassistant.learning_assistant.dto.QuizAttemptResponse;
import com.learningassistant.learning_assistant.dto.QuizStartRequest;
import com.learningassistant.learning_assistant.dto.QuizSubmitRequest;
import com.learningassistant.learning_assistant.dto.AnalyticsResponse;
import com.learningassistant.learning_assistant.dto.PasswordChangeRequest;
import com.learningassistant.learning_assistant.dto.ProfileUpdateRequest;
import com.learningassistant.learning_assistant.dto.UserProfileResponse;
import com.learningassistant.learning_assistant.dto.InterviewFlagRequest;
import com.learningassistant.learning_assistant.entity.StudyPlan;
import com.learningassistant.learning_assistant.entity.StudyTask;
import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.entity.InterviewSession;
import com.learningassistant.learning_assistant.entity.InterviewAccess;
import com.learningassistant.learning_assistant.repository.StudyPlanRepository;
import com.learningassistant.learning_assistant.repository.UserRepository;
import com.learningassistant.learning_assistant.repository.InterviewSessionRepository;
import com.learningassistant.learning_assistant.repository.InterviewAccessRepository;
import com.learningassistant.learning_assistant.service.AnalyticsService;
import com.learningassistant.learning_assistant.service.DashboardService;
import com.learningassistant.learning_assistant.service.InterviewService;
import com.learningassistant.learning_assistant.security.JwtService;
import com.learningassistant.learning_assistant.service.QuizService;
import com.learningassistant.learning_assistant.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:quiz-tests;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "gemini.api-key=",
        "groq.api-key=",
        "openrouter.api-key=",
        "ai.provider=groq",
        "ai.enabled-providers=groq,openrouter",
        "ai.fallback-providers=openrouter",
        "ai-interview.admin-email=interview-admin@example.com",
        "app.jwt.secret=test-only-secret-with-at-least-32-characters"
})
@AutoConfigureMockMvc
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
    private DashboardService dashboardService;

    @Autowired
    private InterviewService interviewService;

    @Autowired
    private InterviewSessionRepository interviewSessionRepository;

    @Autowired
    private InterviewAccessRepository interviewAccessRepository;

    @Autowired
    private StudyPlanRepository studyPlanRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void profileUpdatesAreUserScopedAndPasswordChangesAreVerified() {
        User user = createUser("profile-learner@example.com");
        user.setPassword(passwordEncoder.encode("original-password"));
        userRepository.save(user);
        User otherUser = createUser("profile-other@example.com");
        String token = "Bearer " + jwtService.generateToken(user.getEmail());
        String otherToken = "Bearer " + jwtService.generateToken(otherUser.getEmail());

        UserProfileResponse initialProfile = userService.getProfile(token);
        assertEquals(user.getId(), initialProfile.userId());
        assertEquals(user.getEmail(), initialProfile.email());
        assertClientError(() -> userService.findUserByEmailForToken(user.getEmail(), otherToken));
        assertClientError(() -> userService.getProfile(null));

        User updated = userService.updateProfile(token, new ProfileUpdateRequest(
                "Updated Learner",
                "updated-profile@example.com",
                "Prepare for technical interviews",
                "Backend Engineer",
                "INTERMEDIATE"
        ));
        String refreshedToken = "Bearer " + userService.createTokenFor(updated);

        assertEquals("Updated Learner", userService.getProfile(refreshedToken).name());
        assertEquals("Prepare for technical interviews", userService.getProfile(refreshedToken).learningGoal());
        assertEquals("updated-profile@example.com", userService.getProfile(refreshedToken).email());
        assertEquals(otherUser.getId(), userService.getProfile(otherToken).userId());
        assertClientError(() -> userService.updateProfile(
                otherToken,
                new ProfileUpdateRequest(
                        "Other Learner",
                        "updated-profile@example.com",
                        "",
                        "",
                        ""
                )
        ));

        userService.changePassword(
                refreshedToken,
                new PasswordChangeRequest("original-password", "new-secure-password")
        );
        User saved = userRepository.findById(user.getId()).orElseThrow();
        assertTrue(passwordEncoder.matches("new-secure-password", saved.getPassword()));
        assertClientError(() -> userService.changePassword(
                refreshedToken,
                new PasswordChangeRequest("wrong-current-password", "another-password")
        ));
    }

    @Test
    void interviewAccessAndAdminGrantsAreScopedToAuthenticatedUsers() {
        User admin = userRepository.findByEmail("interview-admin@example.com")
                .orElseGet(() -> createUser("interview-admin@example.com"));
        User learner = createUser("interview-learner@example.com");
        User otherLearner = createUser("interview-other@example.com");
        String adminToken = "Bearer " + jwtService.generateToken(admin.getEmail());
        String learnerToken = "Bearer " + jwtService.generateToken(learner.getEmail());
        String otherToken = "Bearer " + jwtService.generateToken(otherLearner.getEmail());

        assertTrue(interviewService.getAccess(adminToken).hasAccess());
        assertTrue(interviewService.getAccess(adminToken).isAdmin());
        assertFalse(interviewService.getAccess(learnerToken).hasAccess());

        var firstGrant = interviewService.grantAccess(adminToken, new com.learningassistant.learning_assistant.dto.InterviewGrantRequest(
                learner.getId(), 14
        ));
        assertTrue(interviewService.getAccess(learnerToken).hasAccess());
        assertFalse(interviewService.getAccess(otherToken).hasAccess());
        assertEquals("ADMIN_GRANT", interviewService.getAccess(learnerToken).accessSource());
        var extendedGrant = interviewService.grantAccess(adminToken,
                new com.learningassistant.learning_assistant.dto.InterviewGrantRequest(learner.getId(), 7));
        long expiryDifferenceMillis = java.time.Duration.between(
                firstGrant.expiresAt().plusDays(7),
                extendedGrant.expiresAt()
        ).toMillis();
        assertTrue(Math.abs(expiryDifferenceMillis) < 2);
        assertClientError(() -> interviewService.grantAccess(
                learnerToken,
                new com.learningassistant.learning_assistant.dto.InterviewGrantRequest(otherLearner.getId(), 30)
        ));
        assertClientError(() -> interviewService.grantAccess(
                adminToken,
                new com.learningassistant.learning_assistant.dto.InterviewGrantRequest(otherLearner.getId(), 366)
        ));
        var matchingUsers = interviewService.searchUsers(adminToken, "interview-learner@example.com");
        assertEquals(1, matchingUsers.size());
        assertEquals(learner.getId(), matchingUsers.getFirst().userId());
        assertEquals("ADMIN_GRANT", matchingUsers.getFirst().accessSource());
        assertNotNull(matchingUsers.getFirst().adminGrantExpiresAt());
        assertClientError(() -> interviewService.searchUsers(learnerToken, "interview"));
        assertClientError(() -> interviewService.revokeAdminGrant(learnerToken, learner.getId()));

        interviewService.revokeAdminGrant(adminToken, learner.getId());
        assertFalse(interviewService.getAccess(learnerToken).hasAccess());
        assertNull(interviewService.getAccess(learnerToken).accessSource());

        interviewService.grantAccess(adminToken,
                new com.learningassistant.learning_assistant.dto.InterviewGrantRequest(otherLearner.getId(), 14));
        InterviewAccess paidAccess = new InterviewAccess();
        paidAccess.setUser(otherLearner);
        paidAccess.setStartsAt(java.time.LocalDateTime.now().minusDays(1));
        paidAccess.setExpiresAt(java.time.LocalDateTime.now().plusDays(29));
        paidAccess.setSource("RAZORPAY");
        interviewAccessRepository.save(paidAccess);
        interviewService.revokeAdminGrant(adminToken, otherLearner.getId());
        assertTrue(interviewService.getAccess(otherToken).hasAccess());
        assertEquals("RAZORPAY", interviewService.getAccess(otherToken).accessSource());
    }

    @Test
    void resumeIsStoredPerUserAndMonitoringSignalsAreVisibleOnlyToAdmin() throws Exception {
        User learner = createUser("resume-learner@example.com");
        User admin = userRepository.findByEmail("interview-admin@example.com")
                .orElseGet(() -> createUser("interview-admin@example.com"));
        String learnerToken = "Bearer " + jwtService.generateToken(learner.getEmail());
        String adminToken = "Bearer " + jwtService.generateToken(admin.getEmail());
        byte[] pdf = createResumePdf();
        var oversizedResume = new MockMultipartFile(
                "file",
                "oversized.pdf",
                "application/pdf",
                new byte[5 * 1024 * 1024 + 1]
        );
        assertClientError(() -> interviewService.uploadResume(learnerToken, oversizedResume));

        mockMvc.perform(multipart("/api/ai-interview/resume")
                        .file(new MockMultipartFile("file", "candidate-resume.pdf", "application/pdf", pdf))
                        .header("Authorization", learnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resumeFileName").value("candidate-resume.pdf"));
        var savedAccess = interviewService.getAccess(learnerToken);
        assertEquals("candidate-resume.pdf", savedAccess.resumeFileName());
        assertNotNull(savedAccess.resumeUploadedAt());
        assertTrue(interviewService.getAccess(learnerToken).resumeFileName().endsWith(".pdf"));

        InterviewSession interview = new InterviewSession();
        interview.setUser(learner);
        interview.setJobRole("Software Engineer");
        interviewSessionRepository.save(interview);
        interviewService.addFlag(
                learnerToken,
                interview.getId(),
                new InterviewFlagRequest("TAB_HIDDEN", "Candidate switched tabs.")
        );

        var reports = interviewService.adminReports(adminToken);
        assertEquals(1, reports.size());
        assertEquals(learner.getEmail(), reports.getFirst().userEmail());
        assertEquals("TAB_HIDDEN", reports.getFirst().flags().getFirst().eventType());
        interviewService.addFlag(
                learnerToken,
                interview.getId(),
                new InterviewFlagRequest("PHONE_DETECTED", "On-device model saw a phone-like object.")
        );
        assertEquals(2, interviewService.adminReports(adminToken).getFirst().flags().size());
        assertClientError(() -> interviewService.adminReports(learnerToken));

        interviewService.deleteResume(learnerToken);
        assertNull(interviewService.getAccess(learnerToken).resumeFileName());
    }

    private byte[] createResumePdf() throws IOException {
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            document.addPage(page);
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                content.beginText();
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                content.newLineAtOffset(50, 700);
                content.showText("Jane Doe Software Engineer Java Spring");
                content.endText();
            }
            document.save(output);
            return output.toByteArray();
        }
    }

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

        var dashboard = dashboardService.getDashboard(token);
        assertEquals(user.getId(), dashboard.userId());
        assertEquals(1, dashboard.totalTasks());
        assertEquals(1, dashboard.completedTasks());
        assertEquals(1, dashboard.totalQuizAttempts());
        assertEquals(1, dashboard.todayTasks().size());
        assertEquals("Algorithms practice", dashboard.todayTasks().getFirst().title());
        assertEquals("Java", dashboard.recentQuizzes().getFirst().topic());
        assertClientError(() -> dashboardService.getDashboard(null));
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
        assertNull(started.score());
        assertNull(started.correctCount());
        assertTrue(started.questions().stream().allMatch(question ->
                question.selectedOption() == null
                        && question.correctOption() == null
                        && question.explanation().isEmpty()
        ));

        QuizAttemptResponse unsubmitted = quizService.getAttempt(token, started.id());
        assertNull(unsubmitted.score());
        assertNull(unsubmitted.correctCount());
        assertTrue(unsubmitted.questions().stream().allMatch(question ->
                question.selectedOption() == null && question.correctOption() == null
        ));

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
    void unansweredQuizQuestionsAreNotCountedAsCorrectAndNewAttemptsStartBlank() {
        User user = createUser("quiz-unanswered@example.com");
        String token = "Bearer " + jwtService.generateToken(user.getEmail());
        QuizStartRequest request = new QuizStartRequest("Java", "Easy", 5, 10);

        QuizAttemptResponse started = quizService.start(token, request);
        assertTrue(started.questions().stream().allMatch(question ->
                question.selectedOption() == null && question.correctOption() == null
        ));

        QuizAttemptResponse submitted = quizService.submit(
                token,
                started.id(),
                new QuizSubmitRequest(java.util.Collections.nCopies(started.questions().size(), -1))
        );

        assertEquals("COMPLETED", submitted.status());
        assertEquals(0, submitted.correctCount());
        assertEquals(0, submitted.score());
        assertTrue(submitted.questions().stream().allMatch(question ->
                question.selectedOption() == null && question.correctOption() != null
        ));

        QuizAttemptResponse nextAttempt = quizService.start(token, request);
        assertEquals("IN_PROGRESS", nextAttempt.status());
        assertNull(nextAttempt.score());
        assertNull(nextAttempt.correctCount());
        assertTrue(nextAttempt.questions().stream().allMatch(question ->
                question.selectedOption() == null && question.correctOption() == null
        ));
    }

    @Test
    void selectedOptionsAreGradedOnlyWhenSubmitted() {
        User user = createUser("quiz-selected@example.com");
        String token = "Bearer " + jwtService.generateToken(user.getEmail());
        QuizAttemptResponse started = quizService.start(
                token,
                new QuizStartRequest("Java", "Easy", 5, 10)
        );

        assertNull(started.questions().getFirst().selectedOption());
        assertNull(started.questions().getFirst().correctOption());
        assertTrue(started.questions().getFirst().explanation().isEmpty());

        QuizAttemptResponse submitted = quizService.submit(
                token,
                started.id(),
                new QuizSubmitRequest(List.of(1, -1, -1, -1, -1))
        );

        assertEquals(1, submitted.questions().getFirst().selectedOption());
        assertEquals(1, submitted.questions().getFirst().correctOption());
        assertNotNull(submitted.questions().getFirst().explanation());
        assertEquals(1, submitted.correctCount());
        assertEquals(20, submitted.score());

        QuizAttemptResponse nextAttempt = quizService.start(
                token,
                new QuizStartRequest("Java", "Easy", 5, 10)
        );
        assertTrue(nextAttempt.questions().stream().allMatch(question ->
                question.selectedOption() == null && question.correctOption() == null
        ));
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

    private void assertClientError(org.junit.jupiter.api.function.Executable action) {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class, action);
        assertTrue(exception.getStatusCode().is4xxClientError());
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
