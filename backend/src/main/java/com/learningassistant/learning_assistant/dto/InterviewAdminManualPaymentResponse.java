package com.learningassistant.learning_assistant.dto;

import java.time.LocalDateTime;

public record InterviewAdminManualPaymentResponse(
        Long id,
        Long userId,
        String userName,
        String userEmail,
        String paymentReference,
        String utr,
        int amountPaise,
        String status,
        LocalDateTime createdAt,
        LocalDateTime submittedAt
) {
}
