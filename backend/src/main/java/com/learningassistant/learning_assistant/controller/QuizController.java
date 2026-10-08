package com.learningassistant.learning_assistant.controller;

import com.learningassistant.learning_assistant.dto.*;
import com.learningassistant.learning_assistant.service.QuizService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/quizzes")
public class QuizController {

    private final QuizService quizService;

    public QuizController(QuizService quizService) {
        this.quizService = quizService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public QuizAttemptResponse start(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody QuizStartRequest request
    ) {
        return quizService.start(authorization, request);
    }

    @GetMapping
    public List<QuizAttemptSummaryResponse> history(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return quizService.history(authorization);
    }

    @GetMapping("/weak-areas")
    public List<QuizWeakAreaResponse> weakAreas(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return quizService.weakAreas(authorization);
    }

    @GetMapping("/{id}")
    public QuizAttemptResponse getAttempt(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id
    ) {
        return quizService.getAttempt(authorization, id);
    }

    @PostMapping("/{id}/submit")
    public QuizAttemptResponse submit(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestBody QuizSubmitRequest request
    ) {
        return quizService.submit(authorization, id, request);
    }
}
