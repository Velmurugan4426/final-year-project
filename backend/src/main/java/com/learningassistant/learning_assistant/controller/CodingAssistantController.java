package com.learningassistant.learning_assistant.controller;

import com.learningassistant.learning_assistant.dto.CodingAssistantRequest;
import com.learningassistant.learning_assistant.dto.CodingAssistantResponse;
import com.learningassistant.learning_assistant.service.CodingAssistantService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/coding-assistant")
public class CodingAssistantController {

    private final CodingAssistantService codingAssistantService;

    public CodingAssistantController(CodingAssistantService codingAssistantService) {
        this.codingAssistantService = codingAssistantService;
    }

    @PostMapping("/chat")
    public CodingAssistantResponse chat(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody CodingAssistantRequest request
    ) {
        return codingAssistantService.respond(authorization, request);
    }
}
