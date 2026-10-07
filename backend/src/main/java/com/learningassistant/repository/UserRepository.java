package com.learningassistant.learning_assistant.repository;

import com.learningassistant.learning_assistant.entity.User;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // Find a user during login using their email
    Optional<User> findByEmail(String email);

    // Check whether an email is already registered
    boolean existsByEmail(String email);
}