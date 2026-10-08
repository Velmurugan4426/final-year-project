package com.learningassistant.learning_assistant.controller;

import com.learningassistant.learning_assistant.dto.AnalyticsResponse;
import com.learningassistant.learning_assistant.service.AnalyticsService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping
    public AnalyticsResponse getAnalytics(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(defaultValue = "30") Integer days
    ) {
        return analyticsService.getAnalytics(authorization, days);
    }
}
