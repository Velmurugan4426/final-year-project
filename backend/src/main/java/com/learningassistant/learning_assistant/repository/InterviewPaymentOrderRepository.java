package com.learningassistant.learning_assistant.repository;

import com.learningassistant.learning_assistant.entity.InterviewPaymentOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface InterviewPaymentOrderRepository extends JpaRepository<InterviewPaymentOrder, Long> {
    Optional<InterviewPaymentOrder> findByRazorpayOrderIdAndUserId(String razorpayOrderId, Long userId);
    boolean existsByPaymentId(String paymentId);
}
