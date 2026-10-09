package com.learningassistant.learning_assistant.controller;

import com.learningassistant.learning_assistant.dto.*;
import com.learningassistant.learning_assistant.service.InterviewService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/ai-interview")
public class InterviewController {

    private final InterviewService interviewService;

    public InterviewController(InterviewService interviewService) {
        this.interviewService = interviewService;
    }

    @GetMapping("/access")
    public InterviewAccessResponse access(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return interviewService.getAccess(authorization);
    }

    @PostMapping(value = "/resume", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public InterviewAccessResponse uploadResume(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestPart("file") MultipartFile file
    ) {
        return interviewService.uploadResume(authorization, file);
    }

    @DeleteMapping("/resume")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteResume(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        interviewService.deleteResume(authorization);
    }

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    public InterviewOrderResponse createOrder(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return interviewService.createOrder(authorization);
    }

    @PostMapping("/orders/verify")
    public InterviewAccessResponse verifyOrder(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody InterviewOrderVerifyRequest request
    ) {
        return interviewService.verifyOrder(authorization, request);
    }

    @GetMapping("/sessions")
    public List<InterviewSessionResponse> sessions(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return interviewService.listSessions(authorization);
    }

    @GetMapping("/sessions/{sessionId}")
    public InterviewSessionResponse session(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long sessionId
    ) {
        return interviewService.getSession(authorization, sessionId);
    }

    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public InterviewSessionResponse start(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody InterviewStartRequest request
    ) {
        return interviewService.startSession(authorization, request);
    }

    @PostMapping("/sessions/{sessionId}/answers")
    public InterviewSessionResponse answer(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long sessionId,
            @RequestBody InterviewAnswerRequest request
    ) {
        return interviewService.answer(authorization, sessionId, request);
    }

    @PostMapping(value = "/sessions/{sessionId}/transcription", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public InterviewTranscriptionResponse transcribe(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long sessionId,
            @RequestPart("audio") MultipartFile audio,
            @RequestParam(defaultValue = "en") String language
    ) {
        return interviewService.transcribeAnswer(authorization, sessionId, audio, language);
    }

    @PostMapping("/sessions/{sessionId}/heartbeat")
    public InterviewSessionResponse heartbeat(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long sessionId
    ) {
        return interviewService.heartbeat(authorization, sessionId);
    }

    @PostMapping("/sessions/{sessionId}/events")
    public InterviewSessionResponse event(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long sessionId,
            @RequestBody InterviewFlagRequest request
    ) {
        return interviewService.addFlag(authorization, sessionId, request);
    }

    @PostMapping("/admin/grants")
    public InterviewAccessResponse grant(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody InterviewGrantRequest request
    ) {
        return interviewService.grantAccess(authorization, request);
    }

    @GetMapping("/admin/users")
    public List<InterviewAdminUserResponse> searchUsers(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam String query
    ) {
        return interviewService.searchUsers(authorization, query);
    }

    @DeleteMapping("/admin/grants/{userId}")
    public InterviewAccessResponse revokeGrant(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long userId
    ) {
        return interviewService.revokeAdminGrant(authorization, userId);
    }

    @GetMapping("/admin/reports")
    public List<InterviewAdminReportResponse> reports(
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        return interviewService.adminReports(authorization);
    }
}
