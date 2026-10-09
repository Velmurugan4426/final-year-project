package com.learningassistant.learning_assistant;

import com.learningassistant.learning_assistant.dto.InterviewAnswerRequest;
import com.learningassistant.learning_assistant.dto.InterviewFlagRequest;
import com.learningassistant.learning_assistant.dto.InterviewStartRequest;
import com.learningassistant.learning_assistant.entity.InterviewAccess;
import com.learningassistant.learning_assistant.entity.InterviewResume;
import com.learningassistant.learning_assistant.entity.InterviewSession;
import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.repository.InterviewManualPaymentRepository;
import com.learningassistant.learning_assistant.repository.InterviewAccessRepository;
import com.learningassistant.learning_assistant.repository.InterviewResumeRepository;
import com.learningassistant.learning_assistant.repository.InterviewSessionRepository;
import com.learningassistant.learning_assistant.repository.UserRepository;
import com.learningassistant.learning_assistant.security.JwtService;
import com.learningassistant.learning_assistant.service.InterviewService;
import com.learningassistant.learning_assistant.service.TutorModelService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:interview-proctoring-tests;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "ai-interview.price-paise=100",
        "gemini.api-key=",
        "grok.api-key=",
        "groq.api-key=",
        "ai-interview.admin-email=proctor-admin@example.com",
        "ai-interview.upi-id=owner@okaxis",
        "ai-interview.upi-payee-name=Interview Owner",
        "app.jwt.secret=test-only-secret-with-at-least-32-characters"
})
class InterviewProctoringIntegrationTests {

    @Autowired
    private InterviewService interviewService;

    @Autowired
    private InterviewSessionRepository sessionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private InterviewAccessRepository accessRepository;

    @Autowired
    private InterviewResumeRepository resumeRepository;

    @Autowired
    private InterviewManualPaymentRepository manualPaymentRepository;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private TutorModelService tutorModelService;

    @Test
    void serverEnforcesViolationLimitsAndKeepsEventsVisibleInAdminReports() {
        User user = userRepository.save(new User(
                "Proctoring learner",
                "proctoring-" + UUID.randomUUID() + "@example.com",
                "test-password"
        ));
        String authorization = "Bearer " + jwtService.generateToken(user.getEmail());
        assertEquals(100, interviewService.getAccess(authorization).pricePaise());

        InterviewSession phoneSession = createSession(user);
        var phoneResult = interviewService.addFlag(
                authorization,
                phoneSession.getId(),
                new InterviewFlagRequest("PHONE_DETECTED", "Phone detected.")
        );
        assertEquals("TERMINATED", phoneResult.status());
        assertEquals("PHONE_DETECTED: A phone was detected during the interview.", phoneResult.terminationReason());
        assertAnswerRejected(authorization, phoneSession.getId());

        assertThreshold(authorization, user, "TAB_HIDDEN", 2);
        assertThreshold(authorization, user, "FULLSCREEN_EXIT", 2);
        assertThreshold(authorization, user, "CAMERA_INTERRUPTED", 3);
        assertThreshold(authorization, user, "MICROPHONE_INTERRUPTED", 3);

        InterviewSession outOfFrameSession = createSession(user);
        var outOfFrameResult = interviewService.addFlag(
                authorization,
                outOfFrameSession.getId(),
                new InterviewFlagRequest("FACE_NOT_VISIBLE", "Face absent in consecutive frames.")
        );
        assertEquals("TERMINATED", outOfFrameResult.status());
        assertEquals(
                "FACE_NOT_VISIBLE: The candidate was out of camera view.",
                outOfFrameResult.terminationReason()
        );
        assertAnswerRejected(authorization, outOfFrameSession.getId());
    }

    private void assertThreshold(String authorization, User user, String eventType, int limit) {
        InterviewSession session = createSession(user);
        for (int occurrence = 1; occurrence <= limit; occurrence++) {
            var result = interviewService.addFlag(
                    authorization,
                    session.getId(),
                    new InterviewFlagRequest(eventType, "Monitoring test event.")
            );
            assertEquals(
                    occurrence == limit ? "TERMINATED" : "IN_PROGRESS",
                    result.status(),
                    eventType + " occurrence " + occurrence
            );
        }
        assertAnswerRejected(authorization, session.getId());
    }

    private void assertAnswerRejected(String authorization, Long sessionId) {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> interviewService.answer(
                        authorization,
                        sessionId,
                        new InterviewAnswerRequest("This answer must not be accepted.")
                )
        );
        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }

    @Test
    void serverExpiresSessionsByTimeAndInactivityAndHeartbeatDoesNotResetTheirTimer() {
        User user = userRepository.save(new User(
                "Timer learner",
                "timer-" + UUID.randomUUID() + "@example.com",
                "test-password"
        ));
        String authorization = "Bearer " + jwtService.generateToken(user.getEmail());
        var session = createSession(user);
        var startedAt = java.time.LocalDateTime.now().minusMinutes(40);
        session.setStartedAt(startedAt);
        session.setExpiresAt(startedAt.plusMinutes(30));
        session.setLastHeartbeatAt(java.time.LocalDateTime.now());
        sessionRepository.save(session);

        var heartbeatResult = interviewService.heartbeat(authorization, session.getId());
        assertEquals("TIME_EXPIRED", heartbeatResult.status());
        assertTrue(heartbeatResult.remainingSeconds() == 0);
        assertAnswerRejected(authorization, session.getId());

        var inactiveSession = createSession(user);
        var inactiveAt = java.time.LocalDateTime.now().minusMinutes(10);
        inactiveSession.setStartedAt(inactiveAt);
        inactiveSession.setExpiresAt(inactiveAt.plusMinutes(30));
        inactiveSession.setLastHeartbeatAt(inactiveAt);
        sessionRepository.save(inactiveSession);

        var inactiveResult = interviewService.heartbeat(authorization, inactiveSession.getId());
        assertEquals("TIME_EXPIRED", inactiveResult.status());
        assertTrue(inactiveResult.terminationReason().contains("without activity"));
    }

    @Test
    void transcribesAudioForTheAuthenticatedActiveInterviewAndRejectsUnsupportedLanguage() throws Exception {
        User user = userRepository.save(new User(
                "Transcription learner",
                "transcription-" + UUID.randomUUID() + "@example.com",
                "test-password"
        ));
        String authorization = "Bearer " + jwtService.generateToken(user.getEmail());
        InterviewSession session = createSession(user);
        session.setCurrentQuestion("Describe your recent project.");
        sessionRepository.save(session);
        var audio = new MockMultipartFile(
                "audio",
                "answer.webm",
                "audio/webm",
                new byte[]{1, 2, 3, 4}
        );
        when(tutorModelService.transcribeInterviewAudio(
                any(byte[].class),
                eq("audio/webm"),
                eq("en"),
                anyString()
        ))
                .thenReturn("I would start by measuring service latency.");

        var result = interviewService.transcribeAnswer(authorization, session.getId(), audio, "en");
        assertEquals("I would start by measuring service latency.", result.transcript());
        assertEquals("Groq Whisper", result.provider());
        verify(tutorModelService).transcribeInterviewAudio(
                any(byte[].class),
                eq("audio/webm"),
                eq("en"),
                eq("Role: Software Engineer. Interview question: Describe your recent project.")
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> interviewService.transcribeAnswer(authorization, session.getId(), audio, "xx")
        );
        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }

    @Test
    void selectedModeAndDifficultyDriveDynamicAiTurnsAndCompletion() {
        User user = userRepository.save(new User(
                "Dynamic interview learner",
                "dynamic-" + UUID.randomUUID() + "@example.com",
                "test-password"
        ));
        String authorization = "Bearer " + jwtService.generateToken(user.getEmail());
        InterviewAccess access = new InterviewAccess();
        access.setUser(user);
        access.setStartsAt(java.time.LocalDateTime.now().minusMinutes(1));
        access.setExpiresAt(java.time.LocalDateTime.now().plusDays(1));
        access.setSource("ADMIN_GRANT");
        accessRepository.save(access);
        InterviewResume resume = new InterviewResume();
        resume.setUser(user);
        resume.setFileName("practice-resume.pdf");
        resume.setResumeText("Java developer with experience building Spring services.");
        resume.setFileData(new byte[]{1, 2, 3});
        resumeRepository.save(resume);
        InterviewResume storedResume = resumeRepository.findByUserId(user.getId()).orElseThrow();
        assertArrayEquals(new byte[]{1, 2, 3}, storedResume.getFileData());
        assertEquals(
                "Java developer with experience building Spring services.",
                storedResume.getResumeText()
        );

        String feedback = """
                {
                  "summary": "Answers showed practical Java design knowledge.",
                  "topics": [
                    {
                      "topic": "Java service design",
                      "rating": "STRONG",
                      "evidence": "Described separating business logic into a testable service.",
                      "nextStep": "Practice explaining service boundaries."
                    },
                    {
                      "topic": "Scalability",
                      "rating": "NEEDS_IMPROVEMENT",
                      "evidence": "Mentioned caching and scaling without discussing tradeoffs.",
                      "nextStep": "Practice evaluating scaling options against measured bottlenecks."
                    }
                  ],
                  "nextSteps": ["Practice system design scenarios."]
                }
                """;
        when(tutorModelService.generateInterviewReply(anyList(), anyString()))
                .thenReturn(
                        "{\"decision\":\"CONTINUE\",\"difficulty\":\"BEGINNER\",\"question\":\"Describe how you would structure a Java service.\"}",
                        "{\"decision\":\"CONTINUE\",\"difficulty\":\"ADVANCED\",\"question\":\"How would you scale this service under heavy load?\"}",
                        "{\"decision\":\"COMPLETE\",\"difficulty\":\"ADVANCED\",\"question\":\"\"}",
                        feedback
                );

        var started = interviewService.startSession(
                authorization,
                new InterviewStartRequest("Java Developer", "TECHNICAL", "BEGINNER")
        );
        assertEquals("TECHNICAL", started.interviewMode());
        assertEquals("BEGINNER", started.difficulty());
        assertEquals("IN_PROGRESS", started.status());
        assertTrue(started.expiresAt().isAfter(started.startedAt()));

        var continued = interviewService.answer(
                authorization,
                started.id(),
                new InterviewAnswerRequest("I would separate business logic into a testable service.")
        );
        assertEquals("IN_PROGRESS", continued.status());
        assertEquals("How would you scale this service under heavy load?", continued.currentQuestion());
        assertEquals(2, continued.transcript().size());

        var completed = interviewService.answer(
                authorization,
                started.id(),
                new InterviewAnswerRequest("I would measure first, then apply caching and horizontal scaling.")
        );
        assertEquals("COMPLETED", completed.status());
        assertTrue(completed.feedback().contains("Java service design"));
        assertTrue(completed.feedback().contains("STRONG"));
        assertTrue(completed.feedback().contains("NEEDS_IMPROVEMENT"));
        assertTrue(completed.feedback().contains("Practice system design scenarios."));
        assertEquals(2, completed.transcript().size());
    }

    @Test
    void manualUpiPaymentRequiresAdminVerificationAndGrantsExactlyOneDay() {
        User learner = userRepository.save(new User(
                "UPI learner",
                "upi-learner-" + UUID.randomUUID() + "@example.com",
                "test-password"
        ));
        User admin = userRepository.findByEmail("proctor-admin@example.com")
                .orElseGet(() -> userRepository.save(new User(
                        "UPI admin",
                        "proctor-admin@example.com",
                        "test-password"
                )));
        String learnerAuthorization = "Bearer " + jwtService.generateToken(learner.getEmail());
        String adminAuthorization = "Bearer " + jwtService.generateToken(admin.getEmail());

        var payment = interviewService.createManualPayment(learnerAuthorization);
        assertEquals(100, payment.amountPaise());
        assertEquals("owner@okaxis", payment.upiId());
        assertEquals("CREATED", payment.status());

        var submitted = interviewService.submitManualPayment(
                learnerAuthorization,
                payment.paymentReference(),
                new com.learningassistant.learning_assistant.dto.InterviewManualPaymentRequest("123456789012")
        );
        assertEquals("PENDING", submitted.status());
        assertTrue(!interviewService.getAccess(learnerAuthorization).hasAccess());
        assertEquals(1, interviewService.pendingManualPayments(adminAuthorization).size());
        ResponseStatusException forbidden = assertThrows(
                ResponseStatusException.class,
                () -> interviewService.pendingManualPayments(learnerAuthorization)
        );
        assertEquals(HttpStatus.FORBIDDEN, forbidden.getStatusCode());

        var approved = interviewService.approveManualPayment(adminAuthorization, payment.id());
        assertEquals("APPROVED", approved.status());
        var access = interviewService.getAccess(learnerAuthorization);
        assertTrue(access.hasAccess());
        assertEquals("PAID_ACCESS", access.accessSource());
        long remainingSeconds = Duration.between(java.time.LocalDateTime.now(), access.expiresAt()).toSeconds();
        assertTrue(remainingSeconds > 86_380 && remainingSeconds <= 86_400);

        ResponseStatusException duplicateApproval = assertThrows(
                ResponseStatusException.class,
                () -> interviewService.approveManualPayment(adminAuthorization, payment.id())
        );
        assertEquals(HttpStatus.CONFLICT, duplicateApproval.getStatusCode());
    }

    @Test
    void duplicateUtrIsRejectedAndAdminRejectionNeverGrantsAccess() {
        User learner = userRepository.save(new User(
                "UPI retry learner",
                "upi-retry-" + UUID.randomUUID() + "@example.com",
                "test-password"
        ));
        User secondLearner = userRepository.save(new User(
                "UPI second learner",
                "upi-second-" + UUID.randomUUID() + "@example.com",
                "test-password"
        ));
        User admin = userRepository.findByEmail("proctor-admin@example.com")
                .orElseGet(() -> userRepository.save(new User(
                        "UPI admin rejection",
                        "proctor-admin@example.com",
                        "test-password"
                )));
        String learnerAuthorization = "Bearer " + jwtService.generateToken(learner.getEmail());
        String secondAuthorization = "Bearer " + jwtService.generateToken(secondLearner.getEmail());
        String adminAuthorization = "Bearer " + jwtService.generateToken(admin.getEmail());
        var firstPayment = interviewService.createManualPayment(learnerAuthorization);
        interviewService.submitManualPayment(
                learnerAuthorization,
                firstPayment.paymentReference(),
                new com.learningassistant.learning_assistant.dto.InterviewManualPaymentRequest("Abc123456789")
        );

        var duplicatePayment = interviewService.createManualPayment(secondAuthorization);
        ResponseStatusException duplicateUtr = assertThrows(
                ResponseStatusException.class,
                () -> interviewService.submitManualPayment(
                        secondAuthorization,
                        duplicatePayment.paymentReference(),
                        new com.learningassistant.learning_assistant.dto.InterviewManualPaymentRequest("abc123456789")
                )
        );
        assertEquals(HttpStatus.CONFLICT, duplicateUtr.getStatusCode());

        interviewService.rejectManualPayment(adminAuthorization, firstPayment.id());
        assertEquals("REJECTED", manualPaymentRepository.findById(firstPayment.id()).orElseThrow().getStatus());
        assertTrue(!interviewService.getAccess(learnerAuthorization).hasAccess());
    }

    private InterviewSession createSession(User user) {
        InterviewSession session = new InterviewSession();
        session.setUser(user);
        session.setJobRole("Software Engineer");
        return sessionRepository.save(session);
    }
}
