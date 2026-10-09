package com.learningassistant.learning_assistant.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Component
public class ResumeFileStorage {

    private final Path storageDirectory;

    public ResumeFileStorage(@Value("${app.resume.storage-path:./uploads/resumes}") String storagePath) {
        this.storageDirectory = Path.of(storagePath).toAbsolutePath().normalize();
    }

    public String store(byte[] contents) throws IOException {
        Files.createDirectories(storageDirectory);
        String storageKey = UUID.randomUUID() + ".pdf";
        Path temporaryFile = Files.createTempFile(storageDirectory, "resume-", ".tmp");
        try {
            Files.write(temporaryFile, contents);
            Files.move(temporaryFile, resolve(storageKey), StandardCopyOption.ATOMIC_MOVE);
            return storageKey;
        } finally {
            Files.deleteIfExists(temporaryFile);
        }
    }

    public byte[] read(String storageKey) throws IOException {
        return Files.readAllBytes(resolve(storageKey));
    }

    public void delete(String storageKey) throws IOException {
        Files.deleteIfExists(resolve(storageKey));
    }

    private Path resolve(String storageKey) {
        if (storageKey == null || !storageKey.matches("[0-9a-fA-F-]{36}\\.pdf")) {
            throw new IllegalArgumentException("Invalid resume storage key.");
        }
        Path file = storageDirectory.resolve(storageKey).normalize();
        if (!file.getParent().equals(storageDirectory)) {
            throw new IllegalArgumentException("Invalid resume storage key.");
        }
        return file;
    }
}
