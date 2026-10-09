package com.learningassistant.learning_assistant.dto;

public record InterviewOrderVerifyRequest(
        String razorpayOrderId,
        String razorpayPaymentId,
        String razorpaySignature
) {
}
