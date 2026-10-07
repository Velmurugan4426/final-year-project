package com.learningassistant.learning_assistant.controller;

import com.learningassistant.learning_assistant.entity.User;
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
            @PathVariable String email
    ) {

        try {

            User user =
                    userService.findByEmail(email);

            // Never expose password
            user.setPassword(null);

            return ResponseEntity.ok(user);

        } catch (RuntimeException exception) {

            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body("User not found");
        }
    }
}