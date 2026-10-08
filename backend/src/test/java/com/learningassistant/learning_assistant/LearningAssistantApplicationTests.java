package com.learningassistant.learning_assistant;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
		"spring.datasource.url=jdbc:h2:mem:learningassistant;DB_CLOSE_DELAY=-1",
		"spring.datasource.username=sa",
		"spring.datasource.password=",
		"gemini.api-key=",
		"grok.api-key=",
		"groq.api-key=",
		"app.jwt.secret=test-only-secret-with-at-least-32-characters"
})
class LearningAssistantApplicationTests {

	@Test
	void contextLoads() {
	}

}
