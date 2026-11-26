package com.hypothesis.search;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Pluggable web search abstraction for HYPOTHESIS.
 * Implement this interface to add Google Custom Search, Tavily, Brave,
 * or academic index providers without changing orchestration logic.
 */
public interface SearchProvider {

    record SearchResult(
        String title,
        String url,
        String snippet,
        String publishedDate,
        String queryUsed
    ) {}

    String providerName();

    boolean isAvailable();

    List<SearchResult> search(String query, int maxResults);

    default CompletableFuture<List<SearchResult>> searchAsync(String query, int maxResults) {
        return CompletableFuture.supplyAsync(() -> search(query, maxResults));
    }
}
