package com.learningassistant.learning_assistant.service;

import com.learningassistant.learning_assistant.dto.LoginRequest;
import com.learningassistant.learning_assistant.dto.LoginResponse;
import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.repository.UserRepository;
import com.learningassistant.learning_assistant.security.JwtService;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;


    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }


    // =========================================================
    // LOGIN
    // =========================================================

    public LoginResponse login(LoginRequest request) {

        // Normalize email exactly like registration
        String email =
                request.getEmail()
                        .trim()
                        .toLowerCase();

        // Find registered user
        User user = userRepository
                .findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Invalid email or password"
                        )
                );


        // =====================================================
        // VERIFY PASSWORD
        // =====================================================

        boolean passwordMatches =
                passwordEncoder.matches(
                        request.getPassword(),
                        user.getPassword()
                );

        if (!passwordMatches) {

            throw new RuntimeException(
                    "Invalid email or password"
            );
        }


        // =====================================================
        // GENERATE JWT
        // =====================================================

        String token =
                jwtService.generateToken(
                        user.getEmail()
                );


        // =====================================================
        // RETURN LOGIN RESPONSE
        // =====================================================

        return new LoginResponse(
                token,
                user.getId(),
                user.getName(),
                user.getEmail()
        );
    }
}