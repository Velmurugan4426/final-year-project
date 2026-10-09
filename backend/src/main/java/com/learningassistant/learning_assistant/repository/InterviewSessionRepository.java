package com.learningassistant.learning_assistant.repository;

import com.learningassistant.learning_assistant.entity.InterviewSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;

public interface InterviewSessionRepository extends JpaRepository<InterviewSession, Long> {
    List<InterviewSession> findTop20ByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<InterviewSession> findByIdAndUserId(Long id, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select session from InterviewSession session where session.id = :sessionId and session.user.id = :userId")
    Optional<InterviewSession> findForUpdateByIdAndUserId(Long sessionId, Long userId);

    @Query("select session from InterviewSession session where session.status in :statuses")
    List<InterviewSession> findSessionsWithStatuses(@Param("statuses") List<String> statuses);

    List<InterviewSession> findTop100ByOrderByCreatedAtDesc();
}
