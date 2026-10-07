package com.learningassistant.learning_assistant.controller;

import com.learningassistant.learning_assistant.dto.TutorConversationResponse;
import com.learningassistant.learning_assistant.dto.TutorMessageResponse;
import com.learningassistant.learning_assistant.dto.TutorSendMessageRequest;
import com.learningassistant.learning_assistant.service.TutorService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tutor")
public class TutorController {

    private final TutorService tutorService;

    public TutorController(TutorService tutorService) {
        this.tutorService = tutorService;
    }

    @GetMapping("/conversations")
    public List<TutorConversationResponse> listConversations(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return tutorService.listConversations(authorization);
    }

    @PostMapping("/conversations")
    @ResponseStatus(HttpStatus.CREATED)
    public TutorConversationResponse createConversation(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return tutorService.createConversation(authorization);
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public List<TutorMessageResponse> listMessages(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long conversationId
    ) {
        return tutorService.listMessages(authorization, conversationId);
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public List<TutorMessageResponse> sendMessage(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long conversationId,
            @RequestBody TutorSendMessageRequest request
    ) {
        return tutorService.sendMessage(
                authorization,
                conversationId,
                request == null ? null : request.message()
        );
    }

    @DeleteMapping("/conversations/{conversationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteConversation(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long conversationId
    ) {
        tutorService.deleteConversation(authorization, conversationId);
    }
}
