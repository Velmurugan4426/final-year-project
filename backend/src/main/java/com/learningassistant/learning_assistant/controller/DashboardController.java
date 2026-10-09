package com.learningassistant.learning_assistant.controller;

import com.learningassistant.learning_assistant.dto.DashboardResponse;
import com.learningassistant.learning_assistant.service.DashboardService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
    public DashboardResponse getDashboard(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return dashboardService.getDashboard(authorization);
    }
}