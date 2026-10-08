package com.learningassistant.learning_assistant.dto;

import java.util.List;

public record CodingAssistantRequest(
        String question,
        String code,
        String language,
        String task,
        List<ChatTurn> history
) {
    public record ChatTurn(String role, String content) {
    }
}
