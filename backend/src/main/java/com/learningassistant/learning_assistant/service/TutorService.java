package com.learningassistant.learning_assistant.service;

import com.learningassistant.learning_assistant.dto.TutorConversationResponse;
import com.learningassistant.learning_assistant.dto.TutorMessageResponse;
import com.learningassistant.learning_assistant.entity.TutorConversation;
import com.learningassistant.learning_assistant.entity.TutorMessage;
import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.repository.TutorConversationRepository;
import com.learningassistant.learning_assistant.repository.TutorMessageRepository;
import com.learningassistant.learning_assistant.repository.UserRepository;
import com.learningassistant.learning_assistant.security.JwtService;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;

@Service
public class TutorService {

    private static final int MAX_MESSAGE_LENGTH = 12000;

    private final TutorConversationRepository conversationRepository;
    private final TutorMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final TutorModelService tutorModelService;

    public TutorService(
            TutorConversationRepository conversationRepository,
            TutorMessageRepository messageRepository,
            UserRepository userRepository,
            JwtService jwtService,
            TutorModelService tutorModelService
    ) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.tutorModelService = tutorModelService;
    }

    @Transactional
    public TutorConversationResponse createConversation(String authorization) {
        User user = authenticatedUser(authorization);
        TutorConversation conversation = new TutorConversation();
        conversation.setUser(user);
        return toResponse(conversationRepository.save(conversation));
    }

    @Transactional
    public List<TutorConversationResponse> listConversations(String authorization) {
        User user = authenticatedUser(authorization);
        return conversationRepository.findByUserIdOrderByUpdatedAtDesc(user.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public List<TutorMessageResponse> listMessages(String authorization, Long conversationId) {
        TutorConversation conversation = ownedConversation(authorization, conversationId);
        return messageRepository.findByConversationIdOrderByIdAsc(conversation.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public List<TutorMessageResponse> sendMessage(
            String authorization,
            Long conversationId,
            String rawMessage
    ) {
        String message = rawMessage == null ? "" : rawMessage.trim();
        if (message.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a message before sending.");
        }
        if (message.length() > MAX_MESSAGE_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Messages must be 12,000 characters or fewer."
            );
        }

        TutorConversation conversation = ownedConversation(authorization, conversationId);
        List<TutorMessage> history = messageRepository
                .findTop40ByConversationIdOrderByIdDesc(conversation.getId())
                .stream()
                .sorted(Comparator.comparing(TutorMessage::getId))
                .toList();
        String answer = tutorModelService.generateReply(history, message);

        if ("New chat".equals(conversation.getTitle())) {
            conversation.setTitle(makeTitle(message));
        }

        TutorMessage question = new TutorMessage();
        question.setConversation(conversation);
        question.setRole("user");
        question.setContent(message);
        messageRepository.save(question);

        TutorMessage reply = new TutorMessage();
        reply.setConversation(conversation);
        reply.setRole("assistant");
        reply.setContent(answer);
        messageRepository.save(reply);
        conversationRepository.save(conversation);

        return messageRepository.findByConversationIdOrderByIdAsc(conversation.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void deleteConversation(String authorization, Long conversationId) {
        TutorConversation conversation = ownedConversation(authorization, conversationId);
        messageRepository.deleteByConversationId(conversation.getId());
        conversationRepository.delete(conversation);
    }

    private User authenticatedUser(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to use AI Tutor.");
        }
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty() || !jwtService.isTokenValid(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Your session has expired. Please sign in again.");
        }
        String email = jwtService.extractEmail(token);
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to use AI Tutor."));
    }

    private TutorConversation ownedConversation(String authorization, Long conversationId) {
        User user = authenticatedUser(authorization);
        return conversationRepository.findByIdAndUserId(conversationId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Conversation not found."
                ));
    }

    private TutorConversationResponse toResponse(TutorConversation conversation) {
        return new TutorConversationResponse(
                conversation.getId(),
                conversation.getTitle(),
                conversation.getCreatedAt(),
                conversation.getUpdatedAt()
        );
    }

    private TutorMessageResponse toResponse(TutorMessage message) {
        return new TutorMessageResponse(
                message.getId(),
                message.getRole(),
                message.getContent(),
                message.getCreatedAt()
        );
    }

    private String makeTitle(String message) {
        String singleLine = message.replaceAll("\\s+", " ").trim();
        return singleLine.length() <= 60 ? singleLine : singleLine.substring(0, 57) + "...";
    }
}
