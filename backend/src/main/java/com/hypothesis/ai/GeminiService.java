package com.hypothesis.ai;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Server-side Google Gemini API client.
 * Reads GEMINI_API_KEY exclusively from environment configuration.
 */
@Service
public class GeminiService {

    private final RestClient restClient;
    private final String apiKey;
    private final String model;
    private final String baseUrl;

    public GeminiService(
        @Value("${hypothesis.gemini.api-key:}") String apiKey,
        @Value("${hypothesis.gemini.model:gemini-4-hydrogen}") String model,
        @Value("${hypothesis.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}") String baseUrl
    ) {
        this.restClient = RestClient.create();
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = baseUrl;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String generateStructuredJson(String prompt) {
        if (!isConfigured()) {
            throw new IllegalStateException("GEMINI_API_KEY is not configured on the server.");
        }
        String endpoint = baseUrl + "/models/" + model + ":generateContent?key=" + apiKey;
        Map<String, Object> body = Map.of(
            "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
            "generationConfig", Map.of("responseMimeType", "application/json")
        );
        JsonNode response = restClient.post()
            .uri(endpoint)
            .contentType(MediaType.APPLICATION_JSON)
            .body(body)
            .retrieve()
            .body(JsonNode.class);

        if (response == null) {
            return "{}";
        }
        return response.at("/candidates/0/content/parts/0/text").asText("{}");
    }

    public String generateNaturalResponse(String systemInstruction, String prompt) {
        if (!isConfigured()) {
            throw new IllegalStateException("GEMINI_API_KEY is not configured on the server.");
        }
        String endpoint = baseUrl + "/models/" + model + ":generateContent?key=" + apiKey;
        Map<String, Object> body = Map.of(
            "systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))),
            "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt))))
        );
        JsonNode response = restClient.post()
            .uri(endpoint)
            .contentType(MediaType.APPLICATION_JSON)
            .body(body)
            .retrieve()
            .body(JsonNode.class);

        if (response == null) {
            return "";
        }
        return response.at("/candidates/0/content/parts/0/text").asText("");
    }
}
