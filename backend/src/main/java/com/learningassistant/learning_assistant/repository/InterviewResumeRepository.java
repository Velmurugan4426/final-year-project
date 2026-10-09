package com.learningassistant.learning_assistant.repository;

import com.learningassistant.learning_assistant.entity.InterviewResume;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface InterviewResumeRepository extends JpaRepository<InterviewResume, Long> {
    Optional<InterviewResume> findByUserId(Long userId);
    List<InterviewResume> findAllByOrderByUploadedAtDesc();
}
