package com.learningassistant.learning_assistant.entity;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name = "study_tasks", indexes = {
        @Index(name = "idx_study_task_plan_date", columnList = "plan_id, session_date")
})
public class StudyTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "plan_id", nullable = false)
    private StudyPlan plan;

    @Column(name = "session_date", nullable = false)
    private LocalDate sessionDate;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Column(nullable = false)
    private boolean completed;

    public Long getId() {
        return id;
    }

    public StudyPlan getPlan() {
        return plan;
    }

    public void setPlan(StudyPlan plan) {
        this.plan = plan;
    }

    public LocalDate getSessionDate() {
        return sessionDate;
    }

    public void setSessionDate(LocalDate sessionDate) {
        this.sessionDate = sessionDate;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public int getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(int durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }
}
