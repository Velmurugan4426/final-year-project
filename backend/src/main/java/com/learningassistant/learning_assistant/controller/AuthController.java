
package com.learningassistant.learning_assistant.controller;

import com.learningassistant.learning_assistant.dto.LoginRequest;
import com.learningassistant.learning_assistant.dto.LoginResponse;
import com.learningassistant.learning_assistant.service.AuthService;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    // Constructor
    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    // Login
    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody LoginRequest request) {

        try {
            LoginResponse response = authService.login(request);

            return ResponseEntity.ok(response);

        } catch (RuntimeException exception) {
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "message",
                            exception.getMessage() != null
                                    ? exception.getMessage()
                                    : "Login failed"
                    ));
        }
    }
}
