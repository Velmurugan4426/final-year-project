package com.learningassistant.learning_assistant.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learningassistant.learning_assistant.entity.TutorMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class TutorModelService {

    private static final Logger logger =
            LoggerFactory.getLogger(TutorModelService.class);

    // ============================================================
    // GEMINI API
    // ============================================================

    private static final String GEMINI_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";

    // ============================================================
    // GROQ API
    // ============================================================

    private static final String GROQ_URL =
            "https://api.groq.com/openai/v1/chat/completions";

    // ============================================================
    // COMMON AI TUTOR INSTRUCTIONS
    // ============================================================

    private static final String TUTOR_INSTRUCTIONS =
            "You are a thoughtful, encouraging personal tutor. "
                    + "Explain concepts clearly, adapt to the learner's level, "
                    + "use simple examples, and guide them toward understanding. "
                    + "For homework, teach the reasoning rather than only giving an answer. "
                    + "When explaining programming concepts, provide practical examples "
                    + "and explain important lines of code when useful.";

    // ============================================================
    // CONFIGURATION
    // ============================================================

    private final String geminiApiKey;
    private final String geminiModel;

    private final String groqApiKey;
    private final String groqModel;

    private final String primaryProvider;

    // ============================================================
    // JSON + HTTP CLIENT
    // ============================================================

    private final ObjectMapper objectMapper =
            new ObjectMapper();

    private final HttpClient httpClient =
            HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    public TutorModelService(

            @Value("${gemini.api-key:}")
            String geminiApiKey,

            @Value("${gemini.model:gemini-3.8-flash}")
            String geminiModel,

            @Value("${groq.api-key:}")
            String groqApiKey,

            @Value("${groq.model:openai/gpt-oss-120b}")
            String groqModel,

            @Value("${ai.provider:gemini}")
            String primaryProvider

    ) {

        this.geminiApiKey = geminiApiKey;
        this.geminiModel = geminiModel;

        this.groqApiKey = groqApiKey;
        this.groqModel = groqModel;

        this.primaryProvider =
                primaryProvider.toLowerCase(Locale.ROOT);

        if (!this.primaryProvider.equals("gemini")
                && !this.primaryProvider.equals("groq")) {

            throw new IllegalArgumentException(
                    "AI_PROVIDER must be either 'gemini' or 'groq'."
            );
        }

        logger.info(
                "AI Tutor primary provider: {}",
                this.primaryProvider
        );
    }

    // ============================================================
    // MAIN AI TUTOR METHOD
    // ============================================================

    public String generateReply(
            List<TutorMessage> history,
            String question
    ) {

        List<String> providers =
                configuredProvidersInOrder();

        // --------------------------------------------------------
        // No provider configured
        // --------------------------------------------------------

        if (providers.isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,

                    "AI Tutor is not configured. "
                            + "Set GEMINI_API_KEY, GROQ_API_KEY, "
                            + "or both on the backend."
            );
        }

        List<String> errors =
                new ArrayList<>();

        HttpStatusCode lastStatus =
                HttpStatus.SERVICE_UNAVAILABLE;

        // --------------------------------------------------------
        // Try providers in order
        // --------------------------------------------------------

        for (String provider : providers) {

            try {

                String answer;

                if (provider.equals("gemini")) {

                    answer =
                            generateWithGemini(
                                    history,
                                    question
                            );

                } else {

                    answer =
                            generateWithGroq(
                                    history,
                                    question
                            );
                }

                // ------------------------------------------------
                // Log when fallback provider succeeds
                // ------------------------------------------------

                if (!provider.equals(providers.getFirst())) {

                    logger.info(
                            "AI Tutor used {} after primary provider {} failed",
                            provider,
                            providers.getFirst()
                    );
                }

                return answer;

            } catch (ResponseStatusException exception) {

                lastStatus =
                        exception.getStatusCode();

                String reason =
                        exception.getReason() == null
                                ? "provider request failed"
                                : exception.getReason();

                logger.warn(
                        "AI Tutor provider {} failed: {}",
                        provider,
                        reason
                );

                errors.add(
                        provider + ": " + reason
                );
            }
        }

        // --------------------------------------------------------
        // All providers failed
        // --------------------------------------------------------

        HttpStatusCode status =
                providers.size() == 1
                        ? lastStatus
                        : HttpStatus.SERVICE_UNAVAILABLE;

        throw new ResponseStatusException(

                status,

                "All configured AI Tutor providers failed. "
                        + String.join(
                        " | ",
                        errors
                )
        );
    }

    // ============================================================
    // PROVIDER ORDER
    // ============================================================

    private List<String> configuredProvidersInOrder() {

        List<String> providers =
                new ArrayList<>();

        boolean hasGemini =
                geminiApiKey != null
                        && !geminiApiKey.isBlank();

        boolean hasGroq =
                groqApiKey != null
                        && !groqApiKey.isBlank();

        // --------------------------------------------------------
        // Gemini primary
        // Gemini -> Groq
        // --------------------------------------------------------

        if (primaryProvider.equals("gemini")) {

            if (hasGemini) {
                providers.add("gemini");
            }

            if (hasGroq) {
                providers.add("groq");
            }

        }

        // --------------------------------------------------------
        // Groq primary
        // Groq -> Gemini
        // --------------------------------------------------------

        else {

            if (hasGroq) {
                providers.add("groq");
            }

            if (hasGemini) {
                providers.add("gemini");
            }
        }

        return providers;
    }

    // ============================================================
    // GEMINI
    // ============================================================

    private String generateWithGemini(
            List<TutorMessage> history,
            String question
    ) {

        // --------------------------------------------------------
        // Gemini conversation contents
        // --------------------------------------------------------

        List<Map<String, Object>> contents =
                new ArrayList<>();

        // --------------------------------------------------------
        // Previous messages
        // --------------------------------------------------------

        for (TutorMessage message : history) {

            contents.add(

                    Map.of(

                            "role",

                            "assistant".equals(
                                    message.getRole()
                            )
                                    ? "model"
                                    : "user",

                            "parts",

                            List.of(

                                    Map.of(

                                            "text",
                                            message.getContent()
                                    )
                            )
                    )
            );
        }

        // --------------------------------------------------------
        // Current question
        // --------------------------------------------------------

        contents.add(

                Map.of(

                        "role",
                        "user",

                        "parts",

                        List.of(

                                Map.of(

                                        "text",
                                        question
                                )
                        )
                )
        );

        // --------------------------------------------------------
        // Gemini request body
        // --------------------------------------------------------

        Map<String, Object> requestBody =
                new LinkedHashMap<>();

        // System instructions

        requestBody.put(

                "systemInstruction",

                Map.of(

                        "parts",

                        List.of(

                                Map.of(

                                        "text",
                                        TUTOR_INSTRUCTIONS
                                )
                        )
                )
        );

        // Conversation

        requestBody.put(
                "contents",
                contents
        );

        // Generation configuration

        requestBody.put(

                "generationConfig",

                Map.of(

                        "temperature",
                        0.7,

                        "maxOutputTokens",
                        4096
                )
        );

        // --------------------------------------------------------
        // Build Gemini URL
        // --------------------------------------------------------

        String encodedModel =
                URLEncoder.encode(
                        geminiModel,
                        StandardCharsets.UTF_8
                );

        URI uri =
                URI.create(
                        GEMINI_URL.formatted(
                                encodedModel
                        )
                );

        // --------------------------------------------------------
        // Build request
        // --------------------------------------------------------

        HttpRequest request =
                buildRequest(

                        uri,

                        "x-goog-api-key",

                        geminiApiKey,

                        requestBody
                );

        // --------------------------------------------------------
        // Send request
        // --------------------------------------------------------

        JsonNode response =
                sendRequest(
                        "Gemini",
                        request
                );

        // --------------------------------------------------------
        // Extract Gemini response
        // --------------------------------------------------------

        JsonNode parts =
                response
                        .path("candidates")
                        .path(0)
                        .path("content")
                        .path("parts");

        StringBuilder answer =
                new StringBuilder();

        for (JsonNode part : parts) {

            if (part.hasNonNull("text")) {

                if (!answer.isEmpty()) {

                    answer.append('\n');
                }

                answer.append(
                        part.path("text").asText()
                );
            }
        }

        return requireAnswer(
                answer.toString(),
                "Gemini"
        );
    }

    // ============================================================
    // GROQ
    // ============================================================

    private String generateWithGroq(
            List<TutorMessage> history,
            String question
    ) {

        // --------------------------------------------------------
        // Groq uses OpenAI-compatible messages
        // --------------------------------------------------------

        List<Map<String, String>> messages =
                new ArrayList<>();

        // --------------------------------------------------------
        // System message
        // --------------------------------------------------------

        messages.add(

                Map.of(

                        "role",
                        "system",

                        "content",
                        TUTOR_INSTRUCTIONS
                )
        );

        // --------------------------------------------------------
        // Previous conversation
        // --------------------------------------------------------

        for (TutorMessage message : history) {

            messages.add(

                    Map.of(

                            "role",

                            "assistant".equals(
                                    message.getRole()
                            )
                                    ? "assistant"
                                    : "user",

                            "content",
                            message.getContent()
                    )
            );
        }

        // --------------------------------------------------------
        // Current user question
        // --------------------------------------------------------

        messages.add(

                Map.of(

                        "role",
                        "user",

                        "content",
                        question
                )
        );

        // --------------------------------------------------------
        // Groq request body
        // --------------------------------------------------------

        Map<String, Object> requestBody =
                new LinkedHashMap<>();

        requestBody.put(
                "model",
                groqModel
        );

        requestBody.put(
                "messages",
                messages
        );

        requestBody.put(
                "temperature",
                0.7
        );

        requestBody.put(
                "max_tokens",
                4096
        );

        // --------------------------------------------------------
        // Build Groq request
        // --------------------------------------------------------

        HttpRequest request =
                buildRequest(

                        URI.create(
                                GROQ_URL
                        ),

                        "Authorization",

                        "Bearer " + groqApiKey,

                        requestBody
                );

        // --------------------------------------------------------
        // Send request
        // --------------------------------------------------------

        JsonNode response =
                sendRequest(
                        "Groq",
                        request
                );

        // --------------------------------------------------------
        // Extract Groq response
        //
        // choices[0].message.content
        // --------------------------------------------------------

        String answer =
                response
                        .path("choices")
                        .path(0)
                        .path("message")
                        .path("content")
                        .asText();

        return requireAnswer(
                answer,
                "Groq"
        );
    }

    // ============================================================
    // BUILD HTTP REQUEST
    // ============================================================

    private HttpRequest buildRequest(
            URI uri,
            String apiKeyHeader,
            String apiKey,
            Object requestBody
    ) {

        try {

            String json =
                    objectMapper.writeValueAsString(
                            requestBody
                    );

            return HttpRequest

                    .newBuilder(uri)

                    .timeout(
                            Duration.ofSeconds(90)
                    )

                    .header(
                            "Content-Type",
                            "application/json"
                    )

                    .header(
                            apiKeyHeader,
                            apiKey
                    )

                    .POST(

                            HttpRequest.BodyPublishers
                                    .ofString(json)
                    )

                    .build();

        } catch (IOException exception) {

            throw new ResponseStatusException(

                    HttpStatus.INTERNAL_SERVER_ERROR,

                    "Unable to prepare the AI Tutor request.",

                    exception
            );
        }
    }

    // ============================================================
    // SEND HTTP REQUEST
    // ============================================================

    private JsonNode sendRequest(
            String provider,
            HttpRequest request
    ) {

        try {

            HttpResponse<String> response =
                    httpClient.send(

                            request,

                            HttpResponse.BodyHandlers
                                    .ofString()
                    );

            // ----------------------------------------------------
            // Provider returned an error
            // ----------------------------------------------------

            if (response.statusCode() < 200
                    || response.statusCode() >= 300) {

                String providerMessage =
                        extractProviderError(
                                response.body()
                        );

                throw new ResponseStatusException(

                        statusForProvider(
                                response.statusCode()
                        ),

                        provider
                                + " request failed ("
                                + response.statusCode()
                                + "): "
                                + providerMessage
                );
            }

            // ----------------------------------------------------
            // Parse successful JSON response
            // ----------------------------------------------------

            return objectMapper.readTree(
                    response.body()
            );

        } catch (InterruptedException exception) {

            Thread.currentThread().interrupt();

            throw new ResponseStatusException(

                    HttpStatus.SERVICE_UNAVAILABLE,

                    provider
                            + " request was interrupted. Please try again.",

                    exception
            );

        } catch (IOException exception) {

            throw new ResponseStatusException(

                    HttpStatus.BAD_GATEWAY,

                    "Could not reach "
                            + provider
                            + ". Please try again.",

                    exception
            );
        }
    }

    // ============================================================
    // PROVIDER HTTP STATUS
    // ============================================================

    private HttpStatus statusForProvider(
            int statusCode
    ) {

        // Rate limit / quota exceeded

        if (statusCode == 429) {

            return HttpStatus.TOO_MANY_REQUESTS;
        }

        // Authentication / authorization error

        if (statusCode == 401
                || statusCode == 403) {

            return HttpStatus.BAD_GATEWAY;
        }

        // Other provider errors

        return HttpStatus.BAD_GATEWAY;
    }

    // ============================================================
    // EXTRACT PROVIDER ERROR
    // ============================================================

    private String extractProviderError(
            String responseBody
    ) {

        try {

            JsonNode error =
                    objectMapper
                            .readTree(
                                    responseBody
                            )
                            .path("error");

            // ----------------------------------------------------
            // Standard error.message
            // ----------------------------------------------------

            String message =
                    error
                            .path("message")
                            .asText();

            if (!message.isBlank()) {

                return message;
            }

            // ----------------------------------------------------
            // Alternative error.detail
            // ----------------------------------------------------

            String detail =
                    error
                            .path("detail")
                            .asText();

            if (!detail.isBlank()) {

                return detail;
            }

        } catch (IOException exception) {

            logger.warn(
                    "AI provider returned an unreadable error response",
                    exception
            );
        }

        return "Check the API key, model name, and provider quota.";
    }

    // ============================================================
    // VALIDATE AI ANSWER
    // ============================================================

    private String requireAnswer(
            String answer,
            String provider
    ) {

        if (answer == null
                || answer.isBlank()) {

            throw new ResponseStatusException(

                    HttpStatus.BAD_GATEWAY,

                    provider
                            + " returned an empty response."
            );
        }

        return answer.trim();
    }
}