package com.learningassistant.learning_assistant.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "interview_sessions", indexes = {
        @Index(name = "idx_interview_session_user_created", columnList = "user_id, created_at")
})
public class InterviewSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "job_role", nullable = false, length = 120)
    private String jobRole;

    @Column(nullable = false, length = 20)
    private String status = "IN_PROGRESS";

    @Column(name = "interview_mode", length = 30)
    private String interviewMode = "FULL";

    @Column(length = 20)
    private String difficulty = "INTERMEDIATE";

    @Column(name = "current_difficulty", length = 20)
    private String currentDifficulty = "INTERMEDIATE";

    @Column(name = "question_count", nullable = false)
    private Integer questionCount = 0;

    @Column(name = "current_question", columnDefinition = "text")
    private String currentQuestion;

    @Column(columnDefinition = "text")
    private String feedback;

    @Column(name = "termination_reason", length = 500)
    private String terminationReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "last_heartbeat_at")
    private LocalDateTime lastHeartbeatAt;

    @ElementCollection
    @CollectionTable(
            name = "interview_session_turns",
            joinColumns = @JoinColumn(name = "session_id")
    )
    @OrderColumn(name = "turn_order")
    private List<Turn> transcript = new ArrayList<>();

    @ElementCollection
    @CollectionTable(
            name = "interview_session_events",
            joinColumns = @JoinColumn(name = "session_id")
    )
    @OrderColumn(name = "event_order")
    private List<MonitoringEvent> monitoringEvents = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (questionCount == null) {
            questionCount = 0;
        }
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getJobRole() {
        return jobRole;
    }

    public void setJobRole(String jobRole) {
        this.jobRole = jobRole;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getInterviewMode() {
        return interviewMode == null ? "FULL" : interviewMode;
    }

    public void setInterviewMode(String interviewMode) {
        this.interviewMode = interviewMode;
    }

    public String getDifficulty() {
        return difficulty == null ? "INTERMEDIATE" : difficulty;
    }

    public void setDifficulty(String difficulty) {
        this.difficulty = difficulty;
    }

    public String getCurrentDifficulty() {
        return currentDifficulty == null ? getDifficulty() : currentDifficulty;
    }

    public void setCurrentDifficulty(String currentDifficulty) {
        this.currentDifficulty = currentDifficulty;
    }

    public int getQuestionCount() {
        return questionCount == null ? 0 : questionCount;
    }

    public void setQuestionCount(int questionCount) {
        this.questionCount = questionCount;
    }

    public String getCurrentQuestion() {
        return currentQuestion;
    }

    public void setCurrentQuestion(String currentQuestion) {
        this.currentQuestion = currentQuestion;
    }

    public String getFeedback() {
        return feedback;
    }

    public void setFeedback(String feedback) {
        this.feedback = feedback;
    }

    public String getTerminationReason() {
        return terminationReason;
    }

    public void setTerminationReason(String terminationReason) {
        this.terminationReason = terminationReason;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(LocalDateTime startedAt) {
        this.startedAt = startedAt;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public LocalDateTime getLastHeartbeatAt() {
        return lastHeartbeatAt;
    }

    public void setLastHeartbeatAt(LocalDateTime lastHeartbeatAt) {
        this.lastHeartbeatAt = lastHeartbeatAt;
    }

    public List<Turn> getTranscript() {
        return transcript;
    }

    public List<MonitoringEvent> getMonitoringEvents() {
        return monitoringEvents;
    }

    @Embeddable
    public static class Turn {

        @Column(name = "question_text", nullable = false, columnDefinition = "text")
        private String question;

        @Column(name = "answer_text", columnDefinition = "text")
        private String answer;

        protected Turn() {
        }

        public Turn(String question, String answer) {
            this.question = question;
            this.answer = answer;
        }

        public String getQuestion() {
            return question;
        }

        public void setQuestion(String question) {
            this.question = question;
        }

        public String getAnswer() {
            return answer;
        }

        public void setAnswer(String answer) {
            this.answer = answer;
        }
    }

    @Embeddable
    public static class MonitoringEvent {

        @Column(name = "event_type", nullable = false, length = 40)
        private String eventType;

        @Column(name = "event_details", length = 500)
        private String details;

        @Column(name = "occurred_at", nullable = false)
        private LocalDateTime occurredAt;

        protected MonitoringEvent() {
        }

        public MonitoringEvent(String eventType, String details, LocalDateTime occurredAt) {
            this.eventType = eventType;
            this.details = details;
            this.occurredAt = occurredAt;
        }

        public String getEventType() {
            return eventType;
        }

        public String getDetails() {
            return details;
        }

        public LocalDateTime getOccurredAt() {
            return occurredAt;
        }
    }
}
