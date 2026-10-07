package com.learningassistant.learning_assistant.entity;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "study_plans",
        indexes = {
                @Index(
                        name = "idx_study_plan_user_created",
                        columnList = "user_id, created_at"
                )
        }
)
public class StudyPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;


    // =========================================================
    // USER
    // =========================================================

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "user_id",
            nullable = false
    )
    private User user;


    // =========================================================
    // PLAN DETAILS
    // =========================================================

    @Column(
            nullable = false,
            length = 120
    )
    private String goal;


    @Column(
            name = "target_date",
            nullable = false
    )
    private LocalDate targetDate;


    /*
     * Integer is intentionally used instead of int.
     *
     * PostgreSQL can contain NULL for old study-plan records.
     * A primitive int cannot store NULL, while Integer can.
     */
    @Column(
            name = "daily_minutes"
    )
    private Integer dailyMinutes;


    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;


    // =========================================================
    // TASKS
    // =========================================================

    @OneToMany(
            mappedBy = "plan",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("sessionDate ASC, id ASC")
    private List<StudyTask> tasks = new ArrayList<>();


    // =========================================================
    // LIFECYCLE
    // =========================================================

    @PrePersist
    protected void onCreate() {

        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }

        /*
         * Give newly-created plans a sensible default
         * if dailyMinutes was not provided.
         */
        if (dailyMinutes == null) {
            dailyMinutes = 60;
        }
    }


    // =========================================================
    // TASK MANAGEMENT
    // =========================================================

    public void addTask(StudyTask task) {

        tasks.add(task);

        task.setPlan(this);
    }


    // =========================================================
    // GETTERS
    // =========================================================

    public Long getId() {
        return id;
    }


    public User getUser() {
        return user;
    }


    public String getGoal() {
        return goal;
    }


    public LocalDate getTargetDate() {
        return targetDate;
    }


    public Integer getDailyMinutes() {
        return dailyMinutes;
    }


    public LocalDateTime getCreatedAt() {
        return createdAt;
    }


    public List<StudyTask> getTasks() {
        return tasks;
    }


    // =========================================================
    // SETTERS
    // =========================================================

    public void setUser(User user) {

        this.user = user;
    }


    public void setGoal(String goal) {

        this.goal = goal;
    }


    public void setTargetDate(LocalDate targetDate) {

        this.targetDate = targetDate;
    }


    public void setDailyMinutes(Integer dailyMinutes) {

        this.dailyMinutes = dailyMinutes;
    }
}