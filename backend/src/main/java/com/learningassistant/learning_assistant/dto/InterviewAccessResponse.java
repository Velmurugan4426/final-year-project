package com.learningassistant.learning_assistant.dto;

import java.time.LocalDateTime;

public record InterviewAccessResponse(
        boolean isAdmin,
        boolean hasAccess,
        LocalDateTime expiresAt,
        String accessSource,
        String resumeFileName,
        LocalDateTime resumeUploadedAt,
        int pricePaise,
        String razorpayKeyId
) {
}
