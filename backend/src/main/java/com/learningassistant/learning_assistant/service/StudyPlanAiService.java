package com.learningassistant.learning_assistant.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learningassistant.learning_assistant.dto.AiStudyPlanRequest;
import com.learningassistant.learning_assistant.dto.StudyPlanCreateRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class StudyPlanAiService {

    private final TutorModelService tutorModelService;
    private final ObjectMapper objectMapper;

    public StudyPlanAiService(
            TutorModelService tutorModelService
    ) {
        this.tutorModelService = tutorModelService;
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Generates a personalized study plan using the AI model.
     */
    public StudyPlanCreateRequest generatePlan(
            AiStudyPlanRequest request
    ) {

        validateRequest(request);

        String prompt = buildPrompt(request);

        String aiResponse = tutorModelService.generateReply(
                List.of(),
                prompt
        );

        return parseAiResponse(
                aiResponse,
                request
        );
    }

    /**
     * Validates the learner's AI planner request
     * before sending it to the AI model.
     */
    private void validateRequest(
            AiStudyPlanRequest request
    ) {

        if (request == null) {
            throw badRequest(
                    "Study plan information is required."
            );
        }

        if (request.goal() == null
                || request.goal().trim().length() < 3
                || request.goal().trim().length() > 120) {

            throw badRequest(
                    "Your goal must be between 3 and 120 characters."
            );
        }

        if (request.topics() == null
                || request.topics().isEmpty()) {

            throw badRequest(
                    "Please provide at least one topic."
            );
        }

        if (request.topics().size() > 30) {

            throw badRequest(
                    "You can provide up to 30 topics."
            );
        }

        if (request.currentLevel() == null
                || request.currentLevel().isBlank()) {

            throw badRequest(
                    "Please select your current learning level."
            );
        }

        if (request.dailyMinutes() < 15
                || request.dailyMinutes() > 480) {

            throw badRequest(
                    "Daily study time must be between 15 minutes and 8 hours."
            );
        }

        if (request.targetDate() == null) {

            throw badRequest(
                    "Please choose a target date."
            );
        }

        LocalDate today = LocalDate.now();

        if (request.targetDate().isBefore(today)) {

            throw badRequest(
                    "Target date cannot be in the past."
            );
        }

        if (request.priority() == null
                || request.priority().isBlank()) {

            throw badRequest(
                    "Please select a learning priority."
            );
        }
    }

    /**
     * Builds the instruction sent to Gemini/Groq.
     *
     * The AI is instructed to return structured JSON
     * so that the backend can safely convert the result
     * into StudyPlanCreateRequest.
     */
    private String buildPrompt(
            AiStudyPlanRequest request
    ) {

        String topics = String.join(
                ", ",
                request.topics()
        );

        return """
                You are the Study Planner Agent inside an AI-powered
                personalized learning assistant.

                Your responsibility is to create a realistic,
                personalized and progressive study plan.

                ==============================
                LEARNER INFORMATION
                ==============================

                Goal:
                %s

                Topics:
                %s

                Current Level:
                %s

                Daily Available Study Time:
                %d minutes

                Target Date:
                %s

                Learning Priority:
                %s

                ==============================
                PLANNING RULES
                ==============================

                1. Create a progressive learning path from easier
                   concepts to harder concepts.

                2. Respect the learner's current level.

                3. Do not overload a single day.

                4. Never exceed the learner's available daily study time.

                5. Divide study time into focused sessions.

                6. Include a mixture of:
                   - Learning
                   - Practice
                   - Revision
                   - Assessment
                   - Mock Test

                7. Give additional attention to high-priority topics.

                8. Include revision sessions before the target date.

                9. Make each session practical and achievable.

                10. Do not create sessions outside the requested
                    target date.

                11. Every study session must contain:
                    - date
                    - title
                    - durationMinutes

                12. The total duration of all sessions on a particular
                    day must not exceed %d minutes.

                13. Use the exact target date provided by the learner.

                14. Do not invent dates outside the requested period.

                15. Do not include explanations outside the JSON response.

                ==============================
                STUDY SESSION TYPES
                ==============================

                Use appropriate session titles such as:

                Learn:
                "Learn Java Classes and Objects"

                Practice:
                "Practice Java Classes and Objects"

                Revision:
                "Revise Java Classes and Objects"

                Assessment:
                "Assessment: Java OOP Basics"

                Mock Test:
                "Mock Test: Java OOP"

                ==============================
                OUTPUT FORMAT
                ==============================

                Return ONLY valid JSON.

                {
                  "goal": "string",
                  "targetDate": "YYYY-MM-DD",
                  "dailyMinutes": number,
                  "tasks": [
                    {
                      "date": "YYYY-MM-DD",
                      "title": "string",
                      "durationMinutes": number
                    }
                  ]
                }

                ==============================
                STRICT JSON RULES
                ==============================

                - Do not use Markdown.
                - Do not use ```json.
                - Do not add text before the JSON.
                - Do not add text after the JSON.
                - durationMinutes must be a positive integer.
                - Every date must use YYYY-MM-DD format.
                - Every date must be between today and the target date.
                - Daily total must not exceed %d minutes.
                - Generate at least one study session.
                """.formatted(
                request.goal().trim(),
                topics,
                request.currentLevel().trim(),
                request.dailyMinutes(),
                request.targetDate(),
                request.priority().trim(),
                request.dailyMinutes(),
                request.dailyMinutes()
        );
    }

    /**
     * Converts the AI JSON response into the existing
     * StudyPlanCreateRequest used by StudyPlanService.
     */
    private StudyPlanCreateRequest parseAiResponse(
            String aiResponse,
            AiStudyPlanRequest originalRequest
    ) {

        try {

            String json = cleanJson(aiResponse);

            JsonNode root =
                    objectMapper.readTree(json);

            if (root == null
                    || root.isMissingNode()
                    || !root.isObject()) {

                throw new IllegalArgumentException(
                        "AI returned an invalid JSON object."
                );
            }

            String goal =
                    root.path("goal").asText();

            if (goal == null
                    || goal.isBlank()) {

                goal = originalRequest.goal().trim();
            }

            String targetDateText =
                    root.path("targetDate").asText();

            if (targetDateText == null
                    || targetDateText.isBlank()) {

                throw new IllegalArgumentException(
                        "AI did not return a target date."
                );
            }

            LocalDate targetDate =
                    LocalDate.parse(
                            targetDateText
                    );

            int dailyMinutes =
                    root.path("dailyMinutes").asInt();

            if (dailyMinutes <= 0) {

                dailyMinutes =
                        originalRequest.dailyMinutes();
            }

            JsonNode tasksNode =
                    root.path("tasks");

            if (!tasksNode.isArray()
                    || tasksNode.isEmpty()) {

                throw new IllegalArgumentException(
                        "AI did not generate any study sessions."
                );
            }

            List<StudyPlanCreateRequest.TaskInput> tasks =
                    new ArrayList<>();

            for (JsonNode taskNode : tasksNode) {

                if (taskNode == null
                        || !taskNode.isObject()) {

                    throw new IllegalArgumentException(
                            "AI generated an invalid study session."
                    );
                }

                String dateText =
                        taskNode
                                .path("date")
                                .asText();

                String title =
                        taskNode
                                .path("title")
                                .asText();

                int durationMinutes =
                        taskNode
                                .path("durationMinutes")
                                .asInt();

                if (dateText == null
                        || dateText.isBlank()) {

                    throw new IllegalArgumentException(
                            "AI generated a study session without a date."
                    );
                }

                if (title == null
                        || title.isBlank()) {

                    throw new IllegalArgumentException(
                            "AI generated a study session without a title."
                    );
                }

                if (durationMinutes <= 0) {

                    throw new IllegalArgumentException(
                            "AI generated an invalid study duration."
                    );
                }

                LocalDate date =
                        LocalDate.parse(dateText);

                tasks.add(
                        new StudyPlanCreateRequest.TaskInput(
                                date,
                                title.trim(),
                                durationMinutes
                        )
                );
            }

            if (tasks.isEmpty()) {

                throw new IllegalArgumentException(
                        "AI did not generate any study sessions."
                );
            }

            return new StudyPlanCreateRequest(
                    goal,
                    targetDate,
                    dailyMinutes,
                    tasks
            );

        } catch (ResponseStatusException exception) {

            throw exception;

        } catch (Exception exception) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "The AI Study Planner returned an invalid study plan. Please try again."
            );
        }
    }

    /**
     * Removes Markdown code fences if the AI accidentally
     * returns JSON inside ```json ... ``` blocks.
     */
    private String cleanJson(
            String response
    ) {

        if (response == null
                || response.isBlank()) {

            throw new IllegalArgumentException(
                    "AI returned an empty response."
            );
        }

        String cleaned =
                response.trim();

        if (cleaned.startsWith("```json")) {

            cleaned =
                    cleaned.substring(7);

        } else if (cleaned.startsWith("```")) {

            cleaned =
                    cleaned.substring(3);
        }

        if (cleaned.endsWith("```")) {

            cleaned =
                    cleaned.substring(
                            0,
                            cleaned.length() - 3
                    );
        }

        return cleaned.trim();
    }

    private ResponseStatusException badRequest(
            String message
    ) {

        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }
}