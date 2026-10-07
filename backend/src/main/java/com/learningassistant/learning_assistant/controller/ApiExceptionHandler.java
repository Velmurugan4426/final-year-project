package com.learningassistant.learning_assistant.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatusException(
            ResponseStatusException exception
    ) {
        String message = exception.getReason() == null
                ? "The request could not be completed."
                : exception.getReason();
        return ResponseEntity
                .status(exception.getStatusCode())
                .body(Map.of("message", message));
    }
}
