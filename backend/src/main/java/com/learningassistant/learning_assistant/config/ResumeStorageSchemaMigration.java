package com.learningassistant.learning_assistant.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

@Component
public class ResumeStorageSchemaMigration implements ApplicationRunner {

    private final DataSource dataSource;

    public ResumeStorageSchemaMigration(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            if (!"PostgreSQL".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName())
                    || isFileDataNullable(connection.getMetaData())) {
                return;
            }
            try (Statement statement = connection.createStatement()) {
                statement.execute("ALTER TABLE interview_resumes ALTER COLUMN file_data DROP NOT NULL");
            }
        }
    }

    private boolean isFileDataNullable(DatabaseMetaData metadata) throws SQLException {
        try (ResultSet columns = metadata.getColumns(null, null, "interview_resumes", "file_data")) {
            if (columns.next()) {
                return "YES".equalsIgnoreCase(columns.getString("IS_NULLABLE"));
            }
        }
        return true;
    }
}
