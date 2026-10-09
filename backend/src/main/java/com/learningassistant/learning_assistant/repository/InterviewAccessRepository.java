package com.learningassistant.learning_assistant.repository;

import com.learningassistant.learning_assistant.entity.InterviewAccess;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDateTime;
import java.util.Optional;

public interface InterviewAccessRepository extends JpaRepository<InterviewAccess, Long> {
    @Query("select a from InterviewAccess a where a.user.id = :userId and a.startsAt <= :now and a.expiresAt > :now order by a.expiresAt desc")
    Optional<InterviewAccess> findActiveAccess(Long userId, LocalDateTime now);

    Optional<InterviewAccess> findTopByUserIdAndExpiresAtAfterOrderByExpiresAtDesc(
            Long userId,
            LocalDateTime now
    );

    Optional<InterviewAccess> findTopByUserIdAndSourceAndExpiresAtAfterOrderByExpiresAtDesc(
            Long userId,
            String source,
            LocalDateTime now
    );

    long deleteByUserIdAndSource(Long userId, String source);
}
