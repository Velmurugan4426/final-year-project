package com.learningassistant.learning_assistant.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "users",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_users_email",
                        columnNames = "email"
                )
        }
)
public class User {

    // =========================================================
    // PRIMARY KEY
    // =========================================================

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;


    // =========================================================
    // USER NAME
    // =========================================================

    @Column(
            nullable = false,
            length = 100
    )
    private String name;


    // =========================================================
    // EMAIL
    // =========================================================

    @Column(
            nullable = false,
            unique = true,
            length = 255
    )
    private String email;

    @Column(name = "learning_goal", length = 500)
    private String learningGoal;

    @Column(name = "target_role", length = 100)
    private String targetRole;

    @Column(name = "experience_level", length = 30)
    private String experienceLevel;


    // =========================================================
    // PASSWORD
    // =========================================================
    // WRITE_ONLY means:
    // Frontend can send password during registration/login,
    // but password will never be returned in JSON responses.

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Column(
            nullable = false,
            length = 255
    )
    private String password;


    // =========================================================
    // ACCOUNT CREATION TIME
    // =========================================================

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;


    // =========================================================
    // CONSTRUCTORS
    // =========================================================

    public User() {
    }

    public User(
            String name,
            String email,
            String password
    ) {
        this.name = name;
        this.email = email;
        this.password = password;
    }


    // =========================================================
    // AUTOMATICALLY SET CREATED TIME
    // =========================================================

    @PrePersist
    protected void onCreate() {

        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }


    // =========================================================
    // GETTERS AND SETTERS
    // =========================================================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public String getLearningGoal() {
        return learningGoal;
    }

    public void setLearningGoal(String learningGoal) {
        this.learningGoal = learningGoal;
    }

    public String getTargetRole() {
        return targetRole;
    }

    public void setTargetRole(String targetRole) {
        this.targetRole = targetRole;
    }

    public String getExperienceLevel() {
        return experienceLevel;
    }

    public void setExperienceLevel(String experienceLevel) {
        this.experienceLevel = experienceLevel;
    }


    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }


    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}