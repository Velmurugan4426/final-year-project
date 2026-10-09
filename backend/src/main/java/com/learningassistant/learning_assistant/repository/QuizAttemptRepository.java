package com.learningassistant.learning_assistant.repository;

import com.learningassistant.learning_assistant.entity.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {

    List<QuizAttempt> findByUserIdOrderByStartedAtDesc(Long userId);

    List<QuizAttempt> findTop5ByUserIdAndStatusOrderByCompletedAtDesc(Long userId, String status);

    @Query("""
            select count(attempt) as completedCount,
                   avg(attempt.score) as averageScore,
                   coalesce(sum(ceil(coalesce(attempt.elapsedSeconds, 0) / 60.0)), 0) as elapsedMinutes
            from QuizAttempt attempt
            where attempt.user.id = :userId
              and attempt.status = 'COMPLETED'
            """)
    QuizAttemptSummary getCompletedSummary(@Param("userId") Long userId);

    @Query("""
            select attempt from QuizAttempt attempt
            where attempt.user.id = :userId
              and attempt.status = 'COMPLETED'
              and attempt.completedAt >= :from
              and attempt.completedAt < :until
            order by attempt.completedAt desc
            """)
    List<QuizAttempt> findCompletedBetween(
            @Param("userId") Long userId,
            @Param("from") LocalDateTime from,
            @Param("until") LocalDateTime until
    );

    Optional<QuizAttempt> findByIdAndUserId(Long id, Long userId);

    interface QuizAttemptSummary {
        Long getCompletedCount();

        Double getAverageScore();

        Double getElapsedMinutes();
    }
}
