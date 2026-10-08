package com.learningassistant.learning_assistant.service;

import com.learningassistant.learning_assistant.dto.CodingAssistantRequest;
import com.learningassistant.learning_assistant.dto.CodingAssistantResponse;
import com.learningassistant.learning_assistant.entity.TutorMessage;
import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.repository.UserRepository;
import com.learningassistant.learning_assistant.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class CodingAssistantService {

    private static final int MAX_QUESTION_LENGTH = 8000;
    private static final int MAX_CODE_LENGTH = 24000;
    private static final int MAX_HISTORY_TURNS = 12;
    private static final int MAX_HISTORY_MESSAGE_LENGTH = 6000;
    private static final Set<String> TASKS = Set.of("Explain", "Debug", "Review", "Optimize", "Write tests", "Ask");

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final TutorModelService modelService;

    public CodingAssistantService(
            UserRepository userRepository,
            JwtService jwtService,
            TutorModelService modelService
    ) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.modelService = modelService;
    }

    public CodingAssistantResponse respond(String authorization, CodingAssistantRequest request) {
        authenticatedUser(authorization);
        if (request == null) {
            throw badRequest("Send a coding question to get started.");
        }

        String question = request.question() == null ? "" : request.question().trim();
        String code = request.code() == null ? "" : request.code();
        String language = request.language() == null ? "" : request.language().trim();
        String task = request.task() == null ? "Ask" : request.task().trim();
        if (question.isBlank() && code.isBlank()) {
            throw badRequest("Enter a question or add code for the assistant to review.");
        }
        if (question.length() > MAX_QUESTION_LENGTH) {
            throw badRequest("Questions must be 8,000 characters or fewer.");
        }
        if (code.length() > MAX_CODE_LENGTH) {
            throw badRequest("Code must be 24,000 characters or fewer.");
        }
        if (!TASKS.contains(task)) {
            throw badRequest("Choose a valid coding assistance task.");
        }
        if (language.length() > 80) {
            throw badRequest("The language name must be 80 characters or fewer.");
        }

        String prompt = """
                Coding task: %s
                Programming language: %s
                User request:
                %s
                %s
                """.formatted(
                task,
                language.isBlank() ? "Not specified" : language,
                question.isBlank() ? "Please analyze the supplied code." : question,
                code.isBlank() ? "No code was supplied." : "Code to use as context:\n```" + language + "\n" + code + "\n```"
        );

        List<TutorMessage> history = new ArrayList<>();
        if (request.history() != null) {
            List<CodingAssistantRequest.ChatTurn> recent = request.history()
                    .stream()
                    .filter(turn -> turn != null
                            && ("user".equals(turn.role()) || "assistant".equals(turn.role()))
                            && turn.content() != null
                            && !turn.content().isBlank())
                    .skip(Math.max(0, request.history().size() - MAX_HISTORY_TURNS))
                    .toList();
            for (CodingAssistantRequest.ChatTurn turn : recent) {
                if (turn.content().length() > MAX_HISTORY_MESSAGE_LENGTH) {
                    throw badRequest("Each conversation message must be 6,000 characters or fewer.");
                }
                TutorMessage message = new TutorMessage();
                message.setRole(turn.role());
                message.setContent(turn.content());
                history.add(message);
            }
        }

        return new CodingAssistantResponse(
                modelService.generateCodeAssistantReply(history, prompt)
        );
    }

    private User authenticatedUser(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to use Coding Assistant.");
        }
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty() || !jwtService.isTokenValid(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Your session has expired. Please sign in again.");
        }
        String email = jwtService.extractEmail(token);
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Please sign in to use Coding Assistant."
                ));
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
