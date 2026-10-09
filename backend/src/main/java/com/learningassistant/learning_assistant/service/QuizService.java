package com.learningassistant.learning_assistant.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learningassistant.learning_assistant.dto.*;
import com.learningassistant.learning_assistant.entity.QuizAttempt;
import com.learningassistant.learning_assistant.entity.User;
import com.learningassistant.learning_assistant.repository.QuizAttemptRepository;
import com.learningassistant.learning_assistant.repository.UserRepository;
import com.learningassistant.learning_assistant.security.JwtService;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigInteger;
import java.text.Normalizer;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class QuizService {

    private static final Logger logger = LoggerFactory.getLogger(QuizService.class);
    private static final int MAX_TOPIC_LENGTH = 120;
    private static final TypeReference<List<StoredQuestion>> STORED_QUESTIONS =
            new TypeReference<>() {};

    private static final List<FallbackQuestion> QUESTION_BANK = List.of(
            new FallbackQuestion("Data Structures", "Which data structure follows the last-in, first-out (LIFO) rule?",
                    List.of("Queue", "Stack", "Binary search tree", "Hash map"), 1,
                    "A stack removes its most recently added element first.", "Foundations"),
            new FallbackQuestion("Data Structures", "Which traversal of a binary search tree visits keys in sorted order?",
                    List.of("Pre-order", "Post-order", "In-order", "Level-order"), 2,
                    "In-order traversal visits the left subtree, node, then right subtree.", "Trees"),
            new FallbackQuestion("Data Structures", "What is the average lookup time for a key in a well-distributed hash table?",
                    List.of("O(1)", "O(log n)", "O(n)", "O(n log n)"), 0,
                    "A good hash function distributes keys across buckets, giving constant-time average lookup.", "Hashing"),
            new FallbackQuestion("Algorithms", "Which algorithmic strategy is used by binary search on a sorted array?",
                    List.of("Greedy choice", "Divide and conquer", "Backtracking", "Breadth-first search"), 1,
                    "Binary search repeatedly halves the remaining search interval.", "Searching"),
            new FallbackQuestion("Algorithms", "What is the worst-case time complexity of merge sort?",
                    List.of("O(n)", "O(log n)", "O(n log n)", "O(n squared)"), 2,
                    "Merge sort splits the input into logarithmically many levels and processes n items per level.", "Sorting"),
            new FallbackQuestion("Java", "Which Java collection preserves insertion order and allows duplicate elements?",
                    List.of("HashSet", "ArrayList", "TreeSet", "HashMap"), 1,
                    "ArrayList preserves insertion order and permits duplicates.", "Collections"),
            new FallbackQuestion("Java", "What does declaring a Java reference as final prevent?",
                    List.of("Calling methods on the object", "Reassigning the reference", "Changing any object fields", "Creating subclasses"),
                    1, "A final reference cannot be reassigned, though the referenced object may still be mutable.", "Language fundamentals"),
            new FallbackQuestion("Java", "Which keyword allows a class to inherit implementation from another class?",
                    List.of("implements", "extends", "inherits", "instanceof"), 1,
                    "A Java class uses extends to inherit from a superclass.", "Object-oriented programming"),
            new FallbackQuestion("SQL", "Which SQL clause filters rows before they are grouped?",
                    List.of("HAVING", "ORDER BY", "WHERE", "GROUP BY"), 2,
                    "WHERE filters individual rows before GROUP BY forms groups.", "Querying"),
            new FallbackQuestion("SQL", "Which join returns every row from the left table, including rows with no match?",
                    List.of("INNER JOIN", "LEFT JOIN", "CROSS JOIN", "SELF JOIN"), 1,
                    "A LEFT JOIN retains every left-side row and fills unmatched right-side columns with NULL.", "Joins"),
            new FallbackQuestion("SQL", "What does COUNT(column_name) exclude from its count?",
                    List.of("Duplicate values", "NULL values", "Negative values", "Values outside an index"), 1,
                    "COUNT(column_name) counts non-NULL values; COUNT(*) counts rows.", "Aggregations"),
            new FallbackQuestion("DBMS", "Which property of a database transaction means committed changes survive a crash?",
                    List.of("Atomicity", "Consistency", "Isolation", "Durability"), 3,
                    "Durability ensures committed data persists despite failures.", "Transactions"),
            new FallbackQuestion("DBMS", "Which normal form removes partial dependencies on part of a composite key?",
                    List.of("First normal form", "Second normal form", "Third normal form", "Boyce-Codd normal form"), 1,
                    "Second normal form requires 1NF and removes partial dependency on a composite candidate key.", "Normalization"),
            new FallbackQuestion("Operating Systems", "Which scheduling algorithm can cause starvation when short jobs keep arriving?",
                    List.of("First-come, first-served", "Shortest-job-first", "Round robin", "FIFO with fixed queue"), 1,
                    "Shortest-job-first can indefinitely delay long jobs if shorter jobs continually arrive.", "Scheduling"),
            new FallbackQuestion("Networking", "Which transport protocol provides ordered, reliable byte-stream delivery?",
                    List.of("UDP", "IP", "TCP", "ARP"), 2,
                    "TCP provides reliable, ordered delivery using acknowledgements and retransmissions.", "Transport protocols"),
            new FallbackQuestion("System Design", "Which component commonly protects a service from a sudden burst of excessive requests?",
                    List.of("Rate limiter", "SQL view", "Compiler", "Load balancer health check"), 0,
                    "A rate limiter caps request frequency to protect downstream services.", "Reliability"),
            new FallbackQuestion("Python", "What is the average lookup complexity for a key in a Python dictionary?",
                    List.of("O(1)", "O(log n)", "O(n)", "O(n log n)"), 0,
                    "Python dictionaries use hash tables, providing average constant-time key lookup.", "Collections"),
            new FallbackQuestion("Algorithms", "Which data structure is typically used by breadth-first search?",
                    List.of("Stack", "Queue", "Heap", "Hash set only"), 1,
                    "A queue processes discovered vertices in the order they were reached.", "Graph traversal"),
            new FallbackQuestion("System Design", "Why do distributed services commonly use idempotency keys for payment requests?",
                    List.of("To compress payloads", "To prevent duplicate processing on retries", "To encrypt responses", "To guarantee lower latency"),
                    1, "An idempotency key lets the service recognize retries and avoid charging twice.", "API design"),
            new FallbackQuestion("Java", "Which statement about Java's ConcurrentHashMap is correct?",
                    List.of("It permits null keys", "It provides thread-safe concurrent access", "It sorts keys automatically", "It is immutable"),
                    1, "ConcurrentHashMap supports thread-safe access without synchronizing the entire map for every operation.", "Concurrency")
    );

    private final QuizAttemptRepository attemptRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final TutorModelService modelService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public QuizService(
            QuizAttemptRepository attemptRepository,
            UserRepository userRepository,
            JwtService jwtService,
            TutorModelService modelService
    ) {
        this.attemptRepository = attemptRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.modelService = modelService;
    }

    public QuizAttemptResponse start(String authorization, QuizStartRequest request) {
        User user = authenticatedUser(authorization);
        validateRequest(request);

        List<QuizAttempt> previousAttempts =
                attemptRepository.findByUserIdOrderByStartedAtDesc(user.getId());
        Set<String> previousQuestions = new HashSet<>();
        for (QuizAttempt attempt : previousAttempts) {
            previousQuestions.addAll(questionKeys(readQuestions(attempt)));
        }

        String prompt = createPrompt(request, previousAttempts);
        List<StoredQuestion> questions = List.of();
        String source = "Question bank fallback";
        String aiFailure = null;

        try {
            TutorModelService.QuizGenerationResult generated =
                    modelService.generateQuizQuestions(prompt);
            questions = parseQuestions(generated.content(), request, previousQuestions);
            source = generated.provider();
        } catch (ResponseStatusException exception) {
            aiFailure = exception.getReason();
            logger.warn("AI quiz generation failed for topic {}: {}", request.topic(), aiFailure);
        } catch (IOException | IllegalArgumentException exception) {
            aiFailure = exception.getMessage();
            logger.warn("AI quiz response could not be used for topic {}: {}", request.topic(), aiFailure);
        }

        if (questions.size() < request.questionCount()) {
            Set<String> used = new HashSet<>(previousQuestions);
            used.addAll(questionKeys(questions));
            List<StoredQuestion> fallback = fallbackQuestions(
                    request.topic(),
                    request.difficulty(),
                    request.questionCount() - questions.size(),
                    used,
                    previousAttempts.size() * request.questionCount()
            );
            questions = new ArrayList<>(questions);
            questions.addAll(fallback);
            if (questions.size() < request.questionCount()) {
                throw new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "There are not enough new questions available right now. Please try another topic."
                );
            }
            if (aiFailure != null) {
                logger.info("Question-bank fallback supplied quiz questions after AI generation failed: {}", aiFailure);
            }
            if (source.equals("Question bank fallback")) {
                source = "Question bank fallback";
            } else {
                source = "AI + question bank";
            }
        }

        QuizAttempt attempt = new QuizAttempt();
        attempt.setUser(user);
        attempt.setTopic(request.topic().trim());
        attempt.setDifficulty(request.difficulty().trim());
        attempt.setTimeLimitMinutes(request.timeLimitMinutes());
        attempt.setGenerationSource(source);
        attempt.setQuestionsJson(writeQuestions(questions));
        attempt = attemptRepository.save(attempt);
        return toResponse(attempt, questions, false);
    }

    @Transactional
    public List<QuizAttemptSummaryResponse> history(String authorization) {
        User user = authenticatedUser(authorization);
        return attemptRepository.findByUserIdOrderByStartedAtDesc(user.getId())
                .stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional
    public QuizAttemptResponse getAttempt(String authorization, Long id) {
        QuizAttempt attempt = ownedAttempt(authorization, id);
        return toResponse(attempt, readQuestions(attempt), "COMPLETED".equals(attempt.getStatus()));
    }

    @Transactional
    public QuizAttemptResponse submit(
            String authorization,
            Long id,
            QuizSubmitRequest request
    ) {
        QuizAttempt attempt = ownedAttempt(authorization, id);
        if (!"IN_PROGRESS".equals(attempt.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This quiz has already been submitted.");
        }

        List<StoredQuestion> questions = readQuestions(attempt);
        if (request == null || request.answers() == null
                || request.answers().size() != questions.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Submit one answer for each question.");
        }

        long elapsedSeconds = Math.max(0, Duration.between(attempt.getStartedAt(), LocalDateTime.now()).getSeconds());
        boolean timedOut = elapsedSeconds > attempt.getTimeLimitMinutes() * 60L + 5;
        int correct = 0;
        List<StoredQuestion> answered = new ArrayList<>(questions.size());

        for (int index = 0; index < questions.size(); index++) {
            StoredQuestion question = questions.get(index);
            Integer answer = timedOut ? null : request.answers().get(index);
            if (answer != null && (answer < -1 || answer >= question.options().size())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "An answer selection is invalid.");
            }
            Integer selectedOption = answer == null || answer < 0 ? null : answer;
            if (selectedOption != null && selectedOption == question.correctOption()) {
                correct++;
            }
            answered.add(question.withSelectedOption(selectedOption));
        }

        attempt.setQuestionsJson(writeQuestions(answered));
        attempt.setCorrectCount(correct);
        attempt.setScore(Math.round(correct * 100.0f / questions.size()));
        attempt.setElapsedSeconds((int) Math.min(elapsedSeconds, Integer.MAX_VALUE));
        attempt.setStatus("COMPLETED");
        attempt.setCompletedAt(LocalDateTime.now());
        attemptRepository.save(attempt);
        return toResponse(attempt, answered, true);
    }

    @Transactional
    public List<QuizWeakAreaResponse> weakAreas(String authorization) {
        User user = authenticatedUser(authorization);
        Map<String, int[]> totals = new HashMap<>();
        for (QuizAttempt attempt : attemptRepository.findByUserIdOrderByStartedAtDesc(user.getId())) {
            if (!"COMPLETED".equals(attempt.getStatus())) {
                continue;
            }
            for (StoredQuestion question : readQuestions(attempt)) {
                int[] result = totals.computeIfAbsent(question.skill(), ignored -> new int[2]);
                result[1]++;
                if (question.selectedOption() != null
                        && question.selectedOption() == question.correctOption()) {
                    result[0]++;
                }
            }
        }
        return totals.entrySet().stream()
                .map(entry -> toWeakArea(entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparingInt(QuizWeakAreaResponse::accuracy)
                        .thenComparing(QuizWeakAreaResponse::skill))
                .toList();
    }

    private void validateRequest(QuizStartRequest request) {
        if (request == null || request.topic() == null || request.topic().isBlank()
                || request.topic().trim().length() > MAX_TOPIC_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Choose a topic with no more than 120 characters."
            );
        }
        if (request.difficulty() == null
                || !Set.of("Easy", "Medium", "Hard").contains(request.difficulty())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose Easy, Medium, or Hard difficulty.");
        }
        if (request.questionCount() == null
                || !Set.of(5, 10).contains(request.questionCount())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose 5 or 10 questions.");
        }
        if (request.timeLimitMinutes() == null
                || !Set.of(10, 15, 20, 30).contains(request.timeLimitMinutes())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a 10, 15, 20, or 30 minute time limit.");
        }
    }

    private String createPrompt(
            QuizStartRequest request,
            List<QuizAttempt> previousAttempts
    ) {
        List<String> recent = previousAttempts.stream()
                .flatMap(attempt -> readQuestions(attempt).stream())
                .map(StoredQuestion::question)
                .limit(40)
                .toList();
        return """
                Create %d original, challenging but fair multiple-choice questions for a %s-level FAANG/MAANG-caliber software engineering interview practice test.
                Topic: %s. Use realistic interview scenarios and test different subskills. Avoid trivia and ambiguous wording.
                Use broadly applicable interview expectations; do not copy or claim to reproduce any employer's proprietary assessment.
                Return only valid JSON in this exact shape:
                {"questions":[{"question":"...","options":["...","...","...","..."],"correctOption":0,"explanation":"...","skill":"...","difficulty":"Easy|Medium|Hard"}]}
                correctOption is a zero-based integer. Each question must have exactly four distinct options, one defensibly correct answer, a concise teaching explanation, and a specific skill label.
                Write new questions, not paraphrases. Never repeat or lightly reword any previously seen question below.
                Previous questions for this learner: %s
                """.formatted(
                request.questionCount(),
                request.difficulty(),
                request.topic().trim(),
                recent.isEmpty() ? "None" : String.join(" | ", recent)
        );
    }

    private List<StoredQuestion> parseQuestions(
            String content,
            QuizStartRequest request,
            Set<String> previousQuestions
    ) throws IOException {
        int start = content.indexOf('{');
        int end = content.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalArgumentException("The model did not return a JSON question set.");
        }
        JsonNode root = objectMapper.readTree(content.substring(start, end + 1));
        JsonNode items = root.path("questions");
        if (!items.isArray()) {
            throw new IllegalArgumentException("The model response did not contain a questions array.");
        }

        List<StoredQuestion> questions = new ArrayList<>();
        Set<String> unique = new HashSet<>(previousQuestions);
        for (JsonNode item : items) {
            String prompt = item.path("question").asText("").trim();
            JsonNode rawOptions = item.path("options");
            JsonNode rawAnswer = item.has("correctOption")
                    ? item.path("correctOption")
                    : item.path("correctAnswer");
            if (prompt.isBlank() || !rawOptions.isArray() || rawOptions.size() != 4
                    || !rawAnswer.canConvertToInt()) {
                continue;
            }
            List<String> options = new ArrayList<>(4);
            for (JsonNode option : rawOptions) {
                String text = option.asText("").trim();
                if (text.isBlank()) {
                    options.clear();
                    break;
                }
                options.add(text);
            }
            int correctOption = rawAnswer.asInt();
            String key = questionKey(prompt);
            if (options.size() != 4 || correctOption < 0 || correctOption >= options.size()
                    || new HashSet<>(options.stream().map(QuizService::questionKey).toList()).size() != 4
                    || !unique.add(key)) {
                continue;
            }
            String skill = item.path("skill").asText("").trim();
            if (skill.isBlank()) {
                skill = request.topic().trim();
            }
            String difficulty = item.path("difficulty").asText(request.difficulty()).trim();
            questions.add(new StoredQuestion(
                    prompt,
                    options,
                    correctOption,
                    item.path("explanation").asText("").trim(),
                    skill,
                    difficulty.isBlank() ? request.difficulty() : difficulty,
                    null
            ));
            if (questions.size() == request.questionCount()) {
                break;
            }
        }
        return questions;
    }

    private List<StoredQuestion> fallbackQuestions(
            String topic,
            String difficulty,
            int count,
            Set<String> used,
            int seed
    ) {
        String family = topicFamily(topic);
        List<StoredQuestion> selected = new ArrayList<>();
        List<FallbackQuestion> prioritized = new ArrayList<>(QUESTION_BANK);
        if (family != null) {
            prioritized.sort(Comparator.comparing(
                    fallback -> !family.equals(fallback.family())
            ));
        }
        for (FallbackQuestion fallback : prioritized) {
            String key = questionKey(fallback.question());
            if (used.add(key)) {
                selected.add(new StoredQuestion(
                        fallback.question(),
                        fallback.options(),
                        fallback.correctOption(),
                        fallback.explanation(),
                        fallback.skill(),
                        difficulty,
                        null
                ));
                if (selected.size() == count) {
                    return selected;
                }
            }
        }

        for (int index = 0; selected.size() < count; index++) {
            BigInteger base = BigInteger.valueOf((long) seed + index + 1);
            BigInteger answer = base.multiply(BigInteger.valueOf(8));
            String prompt = "In an interview algorithm-tracing exercise, a variable starts at "
                    + base + " and is doubled three times. What is its final value?";
            if (!used.add(questionKey(prompt))) {
                continue;
            }
            List<String> options = List.of(
                    answer.subtract(base).toString(),
                    answer.add(base).toString(),
                    answer.toString(),
                    answer.add(base.multiply(BigInteger.TWO)).toString()
            );
            selected.add(new StoredQuestion(
                    prompt,
                    options,
                    2,
                    "Three doublings multiply the starting value by 2 x 2 x 2, which is 8.",
                    "Algorithm tracing",
                    difficulty,
                    null
            ));
        }
        return selected;
    }

    private String topicFamily(String topic) {
        String normalized = topic.toLowerCase(Locale.ROOT);
        if (normalized.contains("data") || normalized.contains("structure") || normalized.contains("dsa")
                || normalized.contains("algorithm")) {
            return normalized.contains("algorithm") ? "Algorithms" : "Data Structures";
        }
        if (normalized.contains("java")) return "Java";
        if (normalized.equals("sql") || normalized.contains("database query")) return "SQL";
        if (normalized.contains("dbms") || normalized.contains("database")) return "DBMS";
        if (normalized.contains("operating") || normalized.equals("os")) return "Operating Systems";
        if (normalized.contains("network")) return "Networking";
        if (normalized.contains("system design")) return "System Design";
        if (normalized.contains("python")) return "Python";
        return null;
    }

    private QuizAttempt ownedAttempt(String authorization, Long id) {
        User user = authenticatedUser(authorization);
        return attemptRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz attempt not found."));
    }

    private User authenticatedUser(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to take a quiz.");
        }
        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isEmpty() || !jwtService.isTokenValid(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Your session has expired. Please sign in again.");
        }
        String email = jwtService.extractEmail(token);
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please sign in to take a quiz."));
    }

    private QuizAttemptResponse toResponse(
            QuizAttempt attempt,
            List<StoredQuestion> questions,
            boolean includeAnswers
    ) {
        List<QuizQuestionResponse> questionResponses = new ArrayList<>(questions.size());
        for (int index = 0; index < questions.size(); index++) {
            StoredQuestion question = questions.get(index);
            questionResponses.add(new QuizQuestionResponse(
                    index + 1,
                    question.question(),
                    question.options(),
                    question.skill(),
                    question.difficulty(),
                    question.selectedOption(),
                    includeAnswers ? question.correctOption() : null,
                    includeAnswers ? question.explanation() : ""
            ));
        }
        List<QuizWeakAreaResponse> weak = includeAnswers
                ? attemptWeakAreas(questions)
                : List.of();
        return new QuizAttemptResponse(
                attempt.getId(),
                attempt.getTopic(),
                attempt.getDifficulty(),
                attempt.getTimeLimitMinutes(),
                includeAnswers ? attempt.getElapsedSeconds() : null,
                includeAnswers ? attempt.getScore() : null,
                includeAnswers ? attempt.getCorrectCount() : null,
                attempt.getStatus(),
                attempt.getGenerationSource(),
                attempt.getStartedAt(),
                attempt.getCompletedAt(),
                questionResponses,
                weak
        );
    }

    private QuizAttemptSummaryResponse toSummary(QuizAttempt attempt) {
        return new QuizAttemptSummaryResponse(
                attempt.getId(),
                attempt.getTopic(),
                attempt.getDifficulty(),
                readQuestions(attempt).size(),
                attempt.getTimeLimitMinutes(),
                attempt.getElapsedSeconds(),
                attempt.getScore(),
                attempt.getCorrectCount(),
                attempt.getStatus(),
                attempt.getGenerationSource(),
                attempt.getStartedAt(),
                attempt.getCompletedAt()
        );
    }

    private List<QuizWeakAreaResponse> attemptWeakAreas(List<StoredQuestion> questions) {
        Map<String, int[]> totals = new HashMap<>();
        for (StoredQuestion question : questions) {
            int[] result = totals.computeIfAbsent(question.skill(), ignored -> new int[2]);
            result[1]++;
            if (question.selectedOption() != null
                    && question.selectedOption() == question.correctOption()) {
                result[0]++;
            }
        }
        return totals.entrySet().stream()
                .map(entry -> toWeakArea(entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparingInt(QuizWeakAreaResponse::accuracy))
                .toList();
    }

    private QuizWeakAreaResponse toWeakArea(String skill, int[] totals) {
        int accuracy = totals[1] == 0 ? 0 : Math.round(totals[0] * 100.0f / totals[1]);
        return new QuizWeakAreaResponse(
                skill,
                totals[0],
                totals[1],
                accuracy,
                "Review the explanations, practice " + skill + " problems, then retake a focused quiz."
        );
    }

    private List<StoredQuestion> readQuestions(QuizAttempt attempt) {
        try {
            return objectMapper.readValue(attempt.getQuestionsJson(), STORED_QUESTIONS);
        } catch (IOException exception) {
            logger.error("Unable to read questions for quiz attempt {}", attempt.getId(), exception);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to load this quiz attempt.");
        }
    }

    private String writeQuestions(List<StoredQuestion> questions) {
        try {
            return objectMapper.writeValueAsString(questions);
        } catch (IOException exception) {
            logger.error("Unable to save generated quiz questions", exception);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to save this quiz.");
        }
    }

    private Set<String> questionKeys(List<StoredQuestion> questions) {
        Set<String> keys = new HashSet<>();
        for (StoredQuestion question : questions) {
            keys.add(questionKey(question.question()));
        }
        return keys;
    }

    private static String questionKey(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }

    private record StoredQuestion(
            String question,
            List<String> options,
            int correctOption,
            String explanation,
            String skill,
            String difficulty,
            Integer selectedOption
    ) {
        private StoredQuestion withSelectedOption(Integer selected) {
            return new StoredQuestion(
                    question, options, correctOption, explanation, skill, difficulty, selected
            );
        }
    }

    private record FallbackQuestion(
            String family,
            String question,
            List<String> options,
            int correctOption,
            String explanation,
            String skill
    ) {
    }
}
