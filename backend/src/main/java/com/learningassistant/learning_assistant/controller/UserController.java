package com.learningassistant.learning_assistant.controller;

import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.dto.PasswordChangeRequest;
import com.learningassistant.learning_assistant.dto.ProfileUpdateRequest;
import com.learningassistant.learning_assistant.dto.ProfileUpdateResponse;
import com.learningassistant.learning_assistant.dto.UserProfileResponse;
import com.learningassistant.learning_assistant.service.UserService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;


    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    public UserController(UserService userService) {
        this.userService = userService;
    }


    // =========================================================
    // REGISTER
    // =========================================================

    @PostMapping
    public ResponseEntity<?> register(
            @RequestBody User user
    ) {

        try {

            User savedUser =
                    userService.register(user);

            // Never return the hashed password
            savedUser.setPassword(null);

            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .body(savedUser);

        } catch (RuntimeException exception) {

            return ResponseEntity
                    .badRequest()
                    .body(exception.getMessage());
        }
    }


    // =========================================================
    // GET USER BY EMAIL
    // =========================================================

    @GetMapping("/email/{email}")
    public ResponseEntity<?> getUserByEmail(
            @PathVariable String email,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        User user = userService.findUserByEmailForToken(email, authorization);
        return ResponseEntity.ok(userService.toProfileResponse(user));
    }

    @GetMapping("/me")
    public UserProfileResponse getCurrentProfile(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return userService.getProfile(authorization);
    }

    @PutMapping("/me")
    public ProfileUpdateResponse updateCurrentProfile(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody ProfileUpdateRequest request
    ) {
        User updatedUser = userService.updateProfile(authorization, request);
        return new ProfileUpdateResponse(
                userService.toProfileResponse(updatedUser),
                userService.createTokenFor(updatedUser)
        );
    }

    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody PasswordChangeRequest request
    ) {
        userService.changePassword(authorization, request);
        return ResponseEntity.noContent().build();
    }
}