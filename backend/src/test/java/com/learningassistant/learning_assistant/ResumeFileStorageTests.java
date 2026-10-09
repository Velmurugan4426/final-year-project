package com.learningassistant.learning_assistant;

import com.learningassistant.learning_assistant.service.ResumeFileStorage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ResumeFileStorageTests {

    @TempDir
    Path storageDirectory;

    @Test
    void storesReadsAndDeletesResumeFiles() throws IOException {
        ResumeFileStorage storage = new ResumeFileStorage(storageDirectory.toString());
        byte[] contents = "%PDF-1.7 test resume".getBytes();

        String storageKey = storage.store(contents);

        assertArrayEquals(contents, storage.read(storageKey));
        storage.delete(storageKey);
        assertThrows(NoSuchFileException.class, () -> storage.read(storageKey));
    }

    @Test
    void rejectsStorageKeysThatCouldEscapeTheStorageDirectory() {
        ResumeFileStorage storage = new ResumeFileStorage(storageDirectory.toString());

        assertThrows(IllegalArgumentException.class, () -> storage.read("..\\outside.pdf"));
    }
}
