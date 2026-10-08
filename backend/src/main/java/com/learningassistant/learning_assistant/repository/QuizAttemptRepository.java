package com.learningassistant.learning_assistant.repository;

import com.learningassistant.learning_assistant.entity.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {

    List<QuizAttempt> findByUserIdOrderByStartedAtDesc(Long userId);

    Optional<QuizAttempt> findByIdAndUserId(Long id, Long userId);
}
