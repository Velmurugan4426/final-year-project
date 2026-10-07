package com.learningassistant.learning_assistant.controller;

import com.learningassistant.learning_assistant.dto.DashboardResponse;
import com.learningassistant.learning_assistant.service.DashboardService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;


    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    public DashboardController(
            DashboardService dashboardService
    ) {
        this.dashboardService = dashboardService;
    }


    // =========================================================
    // GET DASHBOARD
    // =========================================================

    @GetMapping
    public ResponseEntity<?> getDashboard(
            @RequestParam String email
    ) {

        try {

            DashboardResponse dashboard =
                    dashboardService.getDashboard(email);

            return ResponseEntity.ok(dashboard);

        } catch (RuntimeException exception) {

            return ResponseEntity
                    .status(HttpStatus.NOT_FOUND)
                    .body(exception.getMessage());
        }
    }
}