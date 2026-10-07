package com.learningassistant.learning_assistant.dto;

public class LoginResponse {

    private String token;
    private Long userId;
    private String name;
    private String email;


    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    public LoginResponse(
            String token,
            Long userId,
            String name,
            String email
    ) {
        this.token = token;
        this.userId = userId;
        this.name = name;
        this.email = email;
    }


    // =========================================================
    // GETTERS
    // =========================================================

    public String getToken() {
        return token;
    }

    public Long getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }


    // =========================================================
    // SETTERS
    // =========================================================

    public void setToken(String token) {
        this.token = token;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}