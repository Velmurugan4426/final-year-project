package com.learningassistant.learning_assistant.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtService {

    /*
     * Token validity:
     *
     * 24 hours
     */
    private static final long TOKEN_EXPIRATION =
            1000L * 60 * 60 * 24;

    private final SecretKey signingKey;


    // =========================================================
    // CONSTRUCTOR
    // =========================================================
    // =========================================================
    public JwtService(@Value("${app.jwt.secret}") String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET must be configured with at least 32 bytes."
            );
        }

        this.signingKey = Keys.hmacShaKeyFor(
                secret.getBytes(StandardCharsets.UTF_8)
        );
    }


    // =========================================================
    // GENERATE TOKEN
    // =========================================================

    public String generateToken(String email) {

        Date issuedAt = new Date();

        Date expiration = new Date(
                issuedAt.getTime() + TOKEN_EXPIRATION
        );

        return Jwts.builder()
                .subject(email)
                .issuedAt(issuedAt)
                .expiration(expiration)
                .signWith(signingKey)
                .compact();
    }


    // =========================================================
    // EXTRACT EMAIL
    // =========================================================

    public String extractEmail(String token) {

        Claims claims = extractAllClaims(token);

        return claims.getSubject();
    }


    // =========================================================
    // EXTRACT ALL CLAIMS
    // =========================================================

    private Claims extractAllClaims(String token) {

        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }


    // =========================================================
    // CHECK TOKEN VALIDITY
    // =========================================================

    public boolean isTokenValid(String token) {

        try {

            extractAllClaims(token);

            return true;

        } catch (Exception exception) {

            return false;
        }
    }


    // =========================================================
    // CHECK TOKEN EXPIRATION
    // =========================================================

    public boolean isTokenExpired(String token) {

        try {

            Date expiration =
                    extractAllClaims(token).getExpiration();

            return expiration.before(new Date());

        } catch (Exception exception) {

            return true;
        }
    }
}