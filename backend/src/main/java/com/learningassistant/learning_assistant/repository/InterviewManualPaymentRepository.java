package com.learningassistant.learning_assistant.repository;

import com.learningassistant.learning_assistant.entity.InterviewManualPayment;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InterviewManualPaymentRepository extends JpaRepository<InterviewManualPayment, Long> {
    Optional<InterviewManualPayment> findByPaymentReferenceAndUserId(String paymentReference, Long userId);
    Optional<InterviewManualPayment> findFirstByUserIdAndStatusInOrderByCreatedAtDesc(Long userId, List<String> statuses);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select payment from InterviewManualPayment payment where payment.id = :id")
    Optional<InterviewManualPayment> findByIdForUpdate(@Param("id") Long id);
    List<InterviewManualPayment> findTop5ByUserIdOrderByCreatedAtDesc(Long userId);
    List<InterviewManualPayment> findTop100ByStatusOrderByCreatedAtAsc(String status);
    boolean existsByUtrIgnoreCase(String utr);
}
