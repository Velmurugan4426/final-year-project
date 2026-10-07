package com.learningassistant.learning_assistant.repository;

import com.learningassistant.learning_assistant.entity.TutorConversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TutorConversationRepository extends JpaRepository<TutorConversation, Long> {

    List<TutorConversation> findByUserIdOrderByUpdatedAtDesc(Long userId);

    Optional<TutorConversation> findByIdAndUserId(Long id, Long userId);
}
