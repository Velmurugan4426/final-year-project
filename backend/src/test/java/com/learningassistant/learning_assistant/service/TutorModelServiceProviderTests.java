package com.learningassistant.learning_assistant.service;

import com.learningassistant.learning_assistant.entity.TutorMessage;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TutorModelServiceProviderTests {

    private HttpServer server;
    private final List<String> requests = new CopyOnWriteArrayList<>();

    @BeforeEach
    void startMockProviders() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            String requestBody = new String(
                    exchange.getRequestBody().readAllBytes(),
                    StandardCharsets.UTF_8
            );
            requests.add(path + " " + requestBody);

            int status = path.equals("/groq") ? 429 : 200;
            String responseBody = path.equals("/gemini/test-model:generateContent")
                    ? """
                    {"candidates":[{"content":{"parts":[{"text":"Gemini response"}]}}]}
                    """
                    : path.equals("/groq")
                    ? """
                    {"error":{"message":"quota exhausted"}}
                    """
                    : """
                    {"choices":[{"message":{"content":"OpenRouter response"}}]}
                    """;
            if (status == 429) {
                exchange.getResponseHeaders().add("Retry-After", "3");
            }
            byte[] response = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, response.length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(response);
            }
        });
        server.start();
    }

    @AfterEach
    void stopMockProviders() {
        server.stop(0);
    }

    @Test
    void groqPrimaryFallsBackToOpenRouterWithoutCallingDisabledGemini() {
        TutorModelService service = service("groq", "groq,openrouter", "openrouter");

        TutorModelService.QuizGenerationResult result = service.generateQuizQuestions("quiz prompt");

        assertEquals("OpenRouter", result.provider());
        assertEquals("OpenRouter response", result.content());
        assertEquals(2, requests.size());
        assertTrue(requests.get(0).startsWith("/groq "));
        assertTrue(requests.get(0).contains("\"model\":\"groq-test-model\""));
        assertTrue(requests.get(1).startsWith("/openrouter "));
        assertTrue(requests.get(1).contains("\"model\":\"openrouter/free\""));
        assertFalse(requests.stream().anyMatch(request -> request.startsWith("/gemini/")));
    }

    @Test
    void configuredOpenRouterPrimaryIsUsedBeforeGroq() {
        TutorModelService service = service("openrouter", "groq,openrouter", "groq");

        String answer = service.generateInterviewReply(List.of(), "interview prompt");

        assertEquals("OpenRouter response", answer);
        assertEquals(1, requests.size());
        assertTrue(requests.getFirst().startsWith("/openrouter "));
        assertFalse(requests.getFirst().contains("groq-test-model"));
        assertFalse(requests.getFirst().startsWith("/gemini/"));
    }

    private TutorModelService service(String primary, String enabled, String fallbacks) {
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        return new TutorModelService(
                "gemini-test-key",
                "test-model",
                baseUrl + "/gemini/%s:generateContent",
                "groq-test-key",
                "groq-test-model",
                baseUrl + "/groq",
                "whisper-test-model",
                "openrouter-test-key",
                "openrouter/free",
                baseUrl + "/openrouter",
                primary,
                enabled,
                fallbacks,
                5
        );
    }
}
