package com.learningassistant.learning_assistant.service;

import com.learningassistant.learning_assistant.dto.AiStudyPlanRequest;
import com.learningassistant.learning_assistant.dto.StudyPlanCreateRequest;
import com.learningassistant.learning_assistant.dto.StudyPlanResponse;
import com.learningassistant.learning_assistant.entity.StudyPlan;
import com.learningassistant.learning_assistant.entity.StudyTask;
import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.repository.StudyPlanRepository;
import com.learningassistant.learning_assistant.repository.UserRepository;
import com.learningassistant.learning_assistant.security.JwtService;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class StudyPlanService {

    private static final int MAX_PLAN_DAYS = 180;
    private static final int MAX_TASKS = 180;

    private final StudyPlanRepository planRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final StudyPlanAiService studyPlanAiService;

    public StudyPlanService(
            StudyPlanRepository planRepository,
            UserRepository userRepository,
            JwtService jwtService,
            StudyPlanAiService studyPlanAiService
    ) {
        this.planRepository = planRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.studyPlanAiService = studyPlanAiService;
    }

    @Transactional
    public List<StudyPlanResponse> listPlans(String authorization) {
        User user = authenticatedUser(authorization);

        return planRepository
                .findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public StudyPlanResponse createPlan(
            String authorization,
            StudyPlanCreateRequest request
    ) {
        User user = authenticatedUser(authorization);

        validate(request);

        StudyPlan plan = new StudyPlan();

        plan.setUser(user);
        plan.setGoal(request.goal().trim());
        plan.setTargetDate(request.targetDate());
        plan.setDailyMinutes(request.dailyMinutes());

        for (StudyPlanCreateRequest.TaskInput input : request.tasks()) {

            StudyTask task = new StudyTask();

            task.setSessionDate(input.date());
            task.setTitle(input.title().trim());
            task.setDurationMinutes(input.durationMinutes());

            plan.addTask(task);
        }

        return toResponse(
                planRepository.save(plan)
        );
    }

    public StudyPlanResponse generateAiPlan(
            String authorization,
            AiStudyPlanRequest request
    ) {
        User user = authenticatedUser(authorization);

        StudyPlanCreateRequest generatedRequest =
                studyPlanAiService.generatePlan(request);

        validate(generatedRequest);

        StudyPlan plan = new StudyPlan();

        plan.setUser(user);
        plan.setGoal(generatedRequest.goal().trim());
        plan.setTargetDate(generatedRequest.targetDate());
        plan.setDailyMinutes(generatedRequest.dailyMinutes());

        for (StudyPlanCreateRequest.TaskInput input
                : generatedRequest.tasks()) {

            StudyTask task = new StudyTask();

            task.setSessionDate(input.date());
            task.setTitle(input.title().trim());
            task.setDurationMinutes(input.durationMinutes());

            plan.addTask(task);
        }

        return toResponse(
                planRepository.save(plan)
        );
    }

    @Transactional
    public StudyPlanResponse updateTask(
            String authorization,
            Long planId,
            Long taskId,
            boolean completed
    ) {
        StudyPlan plan = ownedPlan(
                authorization,
                planId
        );

        StudyTask task = plan.getTasks()
                .stream()
                .filter(candidate ->
                        candidate.getId().equals(taskId)
                )
                .findFirst()
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Study session not found."
                        )
                );

        task.setCompleted(completed);

        return toResponse(plan);
    }

    @Transactional
    public void deletePlan(
            String authorization,
            Long planId
    ) {
        planRepository.delete(
                ownedPlan(authorization, planId)
        );
    }

    private void validate(
            StudyPlanCreateRequest request
    ) {

        if (request == null) {
            throw badRequest(
                    "A study plan is required."
            );
        }

        if (request.goal() == null
                || request.goal().trim().length() < 3
                || request.goal().trim().length() > 120) {

            throw badRequest(
                    "Your goal must be between 3 and 120 characters."
            );
        }

        if (request.targetDate() == null) {
            throw badRequest(
                    "Choose a target date."
            );
        }

        LocalDate today = LocalDate.now();

        long days = ChronoUnit.DAYS.between(
                today,
                request.targetDate()
        );

        if (request.targetDate().isBefore(today)
                || days > MAX_PLAN_DAYS) {

            throw badRequest(
                    "Choose a target date within the next 180 days."
            );
        }

        if (request.dailyMinutes() < 15
                || request.dailyMinutes() > 480) {

            throw badRequest(
                    "Daily study time must be between 15 minutes and 8 hours."
            );
        }

        if (request.tasks() == null
                || request.tasks().isEmpty()
                || request.tasks().size() > MAX_TASKS) {

            throw badRequest(
                    "A plan must contain between 1 and 180 study sessions."
            );
        }

        Map<LocalDate, Integer> minutesByDay =
                new HashMap<>();

        for (StudyPlanCreateRequest.TaskInput task
                : request.tasks()) {

            if (task == null
                    || task.date() == null
                    || task.title() == null
                    || task.title().trim().isEmpty()
                    || task.title().trim().length() > 120
                    || task.durationMinutes() < 1
                    || task.durationMinutes() > 480
                    || task.date().isBefore(today)
                    || task.date().isAfter(request.targetDate())) {

                throw badRequest(
                        "Study sessions must have a valid title, date, and duration."
                );
            }

            int totalMinutes =
                    minutesByDay.merge(
                            task.date(),
                            task.durationMinutes(),
                            Integer::sum
                    );

            if (totalMinutes > request.dailyMinutes()) {

                throw badRequest(
                        "Daily study sessions cannot exceed your available study time."
                );
            }
        }
    }

    private ResponseStatusException badRequest(
            String message
    ) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }

    private User authenticatedUser(
            String authorization
    ) {

        if (authorization == null
                || !authorization.startsWith("Bearer ")) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please sign in to use Study Planner."
            );
        }

        String token = authorization
                .substring("Bearer ".length())
                .trim();

        if (token.isEmpty()
                || !jwtService.isTokenValid(token)) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Your session has expired. Please sign in again."
            );
        }

        String email = jwtService.extractEmail(token);

        return userRepository
                .findByEmail(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "Please sign in to use Study Planner."
                        )
                );
    }

    private StudyPlan ownedPlan(
            String authorization,
            Long planId
    ) {

        User user = authenticatedUser(
                authorization
        );

        return planRepository
                .findByIdAndUserId(
                        planId,
                        user.getId()
                )
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Study plan not found."
                        )
                );
    }

    private StudyPlanResponse toResponse(
            StudyPlan plan
    ) {

        return new StudyPlanResponse(
                plan.getId(),
                plan.getGoal(),
                plan.getTargetDate(),
                plan.getDailyMinutes(),
                plan.getCreatedAt(),

                plan.getTasks()
                        .stream()
                        .map(task ->
                                new StudyPlanResponse.TaskResponse(
                                        task.getId(),
                                        task.getSessionDate(),
                                        task.getTitle(),
                                        task.getDurationMinutes(),
                                        task.isCompleted()
                                )
                        )
                        .toList()
        );
    }
}