package com.learningassistant.learning_assistant.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.SQLException;

@Component
public class InterviewSessionSchemaMigration implements ApplicationRunner {

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    public InterviewSessionSchemaMigration(DataSource dataSource, JdbcTemplate jdbcTemplate) {
        this.dataSource = dataSource;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) throws SQLException {
        try (var connection = dataSource.getConnection()) {
            if (!"PostgreSQL".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName())) {
                return;
            }

            try (var flagsColumns = connection.getMetaData()
                    .getColumns(connection.getCatalog(), null, "interview_sessions", "flags_json")) {
                if (flagsColumns.next()) {
                    jdbcTemplate.execute(
                            "ALTER TABLE interview_sessions ALTER COLUMN flags_json DROP NOT NULL"
                    );
                }
            }

            try (var transcriptColumns = connection.getMetaData()
                    .getColumns(connection.getCatalog(), null, "interview_sessions", "transcript_json")) {
                if (transcriptColumns.next()) {
                    jdbcTemplate.execute(
                            "UPDATE interview_sessions SET transcript_json = '[]'::jsonb WHERE transcript_json IS NULL"
                    );
                    jdbcTemplate.execute(
                            "ALTER TABLE interview_sessions ALTER COLUMN transcript_json DROP NOT NULL"
                    );
                }
            }

            try (var questionColumns = connection.getMetaData()
                    .getColumns(connection.getCatalog(), null, "interview_sessions", "question_count")) {
                if (questionColumns.next()) {
                    jdbcTemplate.execute(
                            "UPDATE interview_sessions SET question_count = 0 WHERE question_count IS NULL"
                    );
                    jdbcTemplate.execute(
                            "ALTER TABLE interview_sessions ALTER COLUMN question_count SET DEFAULT 0"
                    );
                }
            }

            try (var feedbackColumns = connection.getMetaData()
                    .getColumns(connection.getCatalog(), null, "interview_session_turns", "answer_feedback")) {
                if (!feedbackColumns.next()) {
                    jdbcTemplate.execute(
                            "ALTER TABLE interview_session_turns ADD COLUMN answer_feedback TEXT"
                    );
                }
            }

            try (var versionColumns = connection.getMetaData()
                    .getColumns(connection.getCatalog(), null, "interview_sessions", "version")) {
                if (!versionColumns.next()) {
                    jdbcTemplate.execute(
                            "ALTER TABLE interview_sessions ADD COLUMN version BIGINT NOT NULL DEFAULT 0"
                    );
                }
            }

            try (var processingColumns = connection.getMetaData()
                    .getColumns(connection.getCatalog(), null, "interview_session_turns", "processing_started_at")) {
                if (!processingColumns.next()) {
                    jdbcTemplate.execute(
                            "ALTER TABLE interview_session_turns ADD COLUMN processing_started_at TIMESTAMP"
                    );
                }
            }

            try (var tokenColumns = connection.getMetaData()
                    .getColumns(connection.getCatalog(), null, "interview_session_turns", "generation_token")) {
                if (!tokenColumns.next()) {
                    jdbcTemplate.execute(
                            "ALTER TABLE interview_session_turns ADD COLUMN generation_token VARCHAR(36)"
                    );
                }
            }
        }
    }
}
