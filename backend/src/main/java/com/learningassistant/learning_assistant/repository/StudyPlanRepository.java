package com.learningassistant.learning_assistant.repository;

import com.learningassistant.learning_assistant.entity.StudyPlan;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StudyPlanRepository extends JpaRepository<StudyPlan, Long> {

    @EntityGraph(attributePaths = "tasks")
    List<StudyPlan> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<StudyPlan> findByIdAndUserId(Long id, Long userId);
}
