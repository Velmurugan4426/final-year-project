package com.learningassistant.learning_assistant.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /*
     * BCrypt is used to securely hash user passwords
     * before they are stored in PostgreSQL.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }


    /*
     * Main Spring Security configuration.
     *
     * Authentication endpoints are currently public:
     *
     * POST /api/users
     * POST /api/auth/login
     *
     * Other application APIs will be protected with JWT
     * when we connect the JWT authentication filter.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http
    ) throws Exception {

        http

                // REST API does not use browser CSRF tokens.
                .csrf(csrf -> csrf.disable())

                // Allow React frontend to communicate with backend.
                .cors(cors -> {})

                // JWT authentication is stateless.
                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )

                // Authentication rules.
                .authorizeHttpRequests(auth -> auth

                        // Registration
                        .requestMatchers(
                                "/api/users"
                        ).permitAll()

                        // Login
                        .requestMatchers(
                                "/api/auth/**"
                        ).permitAll()

                        // Temporary access while building modules.
                        // JWT protection will be enabled for the
                        // application APIs once the authentication
                        // module is connected completely.
                        .anyRequest().permitAll()
                );

        return http.build();
    }
}