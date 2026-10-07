package com.learningassistant.learning_assistant.controller;

import com.learningassistant.learning_assistant.dto.AiStudyPlanRequest;
import com.learningassistant.learning_assistant.dto.StudyPlanCreateRequest;
import com.learningassistant.learning_assistant.dto.StudyPlanResponse;
import com.learningassistant.learning_assistant.dto.StudyTaskCompletionRequest;
import com.learningassistant.learning_assistant.service.StudyPlanService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/study-plans")
public class StudyPlanController {

    private final StudyPlanService studyPlanService;

    public StudyPlanController(StudyPlanService studyPlanService) {
        this.studyPlanService = studyPlanService;
    }

    @GetMapping
    public List<StudyPlanResponse> listPlans(
            @RequestHeader(value = "Authorization", required = false)
            String authorization
    ) {
        return studyPlanService.listPlans(authorization);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StudyPlanResponse createPlan(
            @RequestHeader(value = "Authorization", required = false)
            String authorization,

            @RequestBody
            StudyPlanCreateRequest request
    ) {
        return studyPlanService.createPlan(authorization, request);
    }

    @PostMapping("/ai-generate")
    @ResponseStatus(HttpStatus.CREATED)
    public StudyPlanResponse generateAiPlan(
            @RequestHeader(value = "Authorization", required = false)
            String authorization,

            @RequestBody
            AiStudyPlanRequest request
    ) {
        return studyPlanService.generateAiPlan(
                authorization,
                request
        );
    }

    @PatchMapping("/{planId}/tasks/{taskId}")
    public StudyPlanResponse updateTask(
            @RequestHeader(value = "Authorization", required = false)
            String authorization,

            @PathVariable Long planId,

            @PathVariable Long taskId,

            @RequestBody StudyTaskCompletionRequest request
    ) {

        if (request == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "A completion status is required."
            );
        }

        return studyPlanService.updateTask(
                authorization,
                planId,
                taskId,
                request.completed()
        );
    }

    @DeleteMapping("/{planId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePlan(
            @RequestHeader(value = "Authorization", required = false)
            String authorization,

            @PathVariable Long planId
    ) {
        studyPlanService.deletePlan(
                authorization,
                planId
        );
    }
}