package com.hypothesis.search;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

@Component
public class GoogleCustomSearchProvider implements SearchProvider {

    private final RestClient restClient;
    private final String apiKey;
    private final String engineId;

    public GoogleCustomSearchProvider(
        @Value("${hypothesis.search.api-key:}") String apiKey,
        @Value("${hypothesis.search.engine-id:}") String engineId
    ) {
        this.restClient = RestClient.create();
        this.apiKey = apiKey;
        this.engineId = engineId;
    }

    @Override
    public String providerName() {
        return "google_cse";
    }

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank() && engineId != null && !engineId.isBlank();
    }

    @Override
    public List<SearchResult> search(String query, int maxResults) {
        if (!isAvailable()) {
            return List.of();
        }
        URI uri = UriComponentsBuilder.fromHttpUrl("https://www.googleapis.com/customsearch/v1")
            .queryParam("key", apiKey)
            .queryParam("cx", engineId)
            .queryParam("q", query)
            .queryParam("num", Math.min(maxResults, 10))
            .build()
            .toUri();

        JsonNode root = restClient.get().uri(uri).retrieve().body(JsonNode.class);
        List<SearchResult> results = new ArrayList<>();
        if (root != null && root.has("items")) {
            for (JsonNode item : root.get("items")) {
                String link = item.path("link").asText("");
                if (link.startsWith("https://") || link.startsWith("http://")) {
                    results.add(new SearchResult(
                        item.path("title").asText("Untitled"),
                        link,
                        item.path("snippet").asText(""),
                        null,
                        query
                    ));
                }
            }
        }
        return results;
    }
}
