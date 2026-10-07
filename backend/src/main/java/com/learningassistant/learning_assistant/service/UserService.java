package com.learningassistant.learning_assistant.service;

import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.repository.UserRepository;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;


    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }


    // =========================================================
    // REGISTER USER
    // =========================================================

    public User register(User user) {

        // Remove accidental spaces from email
        String email = user.getEmail().trim().toLowerCase();

        // Check whether email is already registered
        if (userRepository.existsByEmail(email)) {

            throw new RuntimeException(
                    "Email is already registered"
            );
        }

        // Store normalized email
        user.setEmail(email);

        // Hash password before saving to PostgreSQL
        String encodedPassword =
                passwordEncoder.encode(
                        user.getPassword()
                );

        user.setPassword(encodedPassword);

        // Save user
        return userRepository.save(user);
    }


    // =========================================================
    // FIND USER BY EMAIL
    // =========================================================

    public User findByEmail(String email) {

        String normalizedEmail =
                email.trim().toLowerCase();

        return userRepository
                .findByEmail(normalizedEmail)
                .orElseThrow(() ->
                        new RuntimeException(
                                "User not found"
                        )
                );
    }


    // =========================================================
    // CHECK EMAIL
    // =========================================================

    public boolean emailExists(String email) {

        String normalizedEmail =
                email.trim().toLowerCase();

        return userRepository.existsByEmail(
                normalizedEmail
        );
    }
}