package com.learningassistant.learning_assistant.dto;

import java.time.LocalDateTime;

public record InterviewManualPaymentResponse(
        Long id,
        String paymentReference,
        String upiId,
        String payeeName,
        int amountPaise,
        String currency,
        String status,
        String utr,
        LocalDateTime createdAt,
        LocalDateTime submittedAt
) {
}
