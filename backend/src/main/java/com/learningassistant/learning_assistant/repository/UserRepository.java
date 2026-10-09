package com.learningassistant.learning_assistant.repository;

import com.learningassistant.learning_assistant.entity.User;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // Find a user during login using their email
    Optional<User> findByEmail(String email);

    // Check whether an email is already registered
    boolean existsByEmail(String email);

    @Query("""
            select u from User u
            where lower(u.name) like lower(concat('%', :query, '%'))
               or lower(u.email) like lower(concat('%', :query, '%'))
            order by u.name
            """)
    List<User> searchForInterviewGrant(
            @Param("query") String query,
            Pageable pageable
    );

    @Query("""
            select u from User u
            where u.id = :userId
            """)
    Optional<User> findByIdForInterviewGrant(@Param("userId") Long userId);
}