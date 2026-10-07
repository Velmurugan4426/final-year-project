package com.learningassistant.learning_assistant.repository;

import com.learningassistant.learning_assistant.entity.TutorMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TutorMessageRepository extends JpaRepository<TutorMessage, Long> {

    List<TutorMessage> findByConversationIdOrderByIdAsc(Long conversationId);

    List<TutorMessage> findTop40ByConversationIdOrderByIdDesc(Long conversationId);

    void deleteByConversationId(Long conversationId);
}
