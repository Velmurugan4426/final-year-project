package com.learningassistant.learning_assistant;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class LearningAssistantApplication {

	public static void main(String[] args) {
		SpringApplication.run(LearningAssistantApplication.class, args);
	}

}
