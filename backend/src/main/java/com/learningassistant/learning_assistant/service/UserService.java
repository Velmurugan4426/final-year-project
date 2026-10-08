package com.learningassistant.learning_assistant.service;

import com.learningassistant.learning_assistant.dto.PasswordChangeRequest;
import com.learningassistant.learning_assistant.dto.ProfileUpdateRequest;
import com.learningassistant.learning_assistant.dto.UserProfileResponse;
import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.repository.UserRepository;
import com.learningassistant.learning_assistant.security.JwtService;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");


    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
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

    public UserProfileResponse getProfile(String authorization) {
        return toProfileResponse(authenticatedUser(authorization));
    }

    public User findUserByEmailForToken(String requestedEmail, String authorization) {
        User user = authenticatedUser(authorization);
        if (requestedEmail == null || !user.getEmail().equalsIgnoreCase(requestedEmail.trim())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
        }
        return user;
    }

    public User updateProfile(String authorization, ProfileUpdateRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile details are required.");
        }

        User user = authenticatedUser(authorization);
        String name = normalizeRequired(request.name(), "Name", 100);
        String email = normalizeRequired(request.email(), "Email", 255).toLowerCase(Locale.ROOT);
        String learningGoal = normalizeOptional(request.learningGoal(), "Learning goal", 500);
        String targetRole = normalizeOptional(request.targetRole(), "Target role", 100);
        String experienceLevel = normalizeOptional(request.experienceLevel(), "Experience level", 30);

        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        }
        if (!experienceLevel.isEmpty()
                && !experienceLevel.equals("BEGINNER")
                && !experienceLevel.equals("INTERMEDIATE")
                && !experienceLevel.equals("ADVANCED")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid experience level.");
        }
        if (!email.equals(user.getEmail()) && userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That email address is already in use.");
        }

        user.setName(name);
        user.setEmail(email);
        user.setLearningGoal(emptyToNull(learningGoal));
        user.setTargetRole(emptyToNull(targetRole));
        user.setExperienceLevel(emptyToNull(experienceLevel));
        return userRepository.save(user);
    }

    public void changePassword(String authorization, PasswordChangeRequest request) {
        if (request == null || request.currentPassword() == null || request.newPassword() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current and new passwords are required.");
        }
        int passwordBytes = request.newPassword().getBytes(StandardCharsets.UTF_8).length;
        if (request.newPassword().length() < 8 || request.newPassword().length() > 72 || passwordBytes > 72) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "New password must contain at least 8 characters and no more than 72 UTF-8 bytes."
            );
        }

        User user = authenticatedUser(authorization);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect.");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a password you have not used before.");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    public UserProfileResponse toProfileResponse(User user) {
        return new UserProfileResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getLearningGoal(),
                user.getTargetRole(),
                user.getExperienceLevel(),
                user.getCreatedAt()
        );
    }

    public String createTokenFor(User user) {
        return jwtService.generateToken(user.getEmail());
    }

    private User authenticatedUser(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to access your profile.");
        }

        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty() || !jwtService.isTokenValid(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Your session is invalid or has expired.");
        }

        String email = jwtService.extractEmail(token);
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Your account could not be found. Please sign in again."
                ));
    }

    private String normalizeRequired(String value, String field, int maxLength) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " is required and must be no longer than " + maxLength + " characters."
            );
        }
        return normalized;
    }

    private String normalizeOptional(String value, String field, int maxLength) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.length() > maxLength) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " must be no longer than " + maxLength + " characters."
            );
        }
        return normalized;
    }

    private String emptyToNull(String value) {
        return value.isEmpty() ? null : value;
    }
}