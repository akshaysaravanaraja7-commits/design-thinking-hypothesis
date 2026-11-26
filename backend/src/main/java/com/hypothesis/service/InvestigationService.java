package com.hypothesis.service;

import com.hypothesis.ai.GeminiService;
import com.hypothesis.model.InvestigationEntity;
import com.hypothesis.repository.InvestigationJpaRepository;
import com.hypothesis.search.SearchProvider;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class InvestigationService {

    private final InvestigationJpaRepository repository;
    private final SearchProvider searchProvider;
    private final GeminiService geminiService;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public InvestigationService(
        InvestigationJpaRepository repository,
        SearchProvider searchProvider,
        GeminiService geminiService
    ) {
        this.repository = repository;
        this.searchProvider = searchProvider;
        this.geminiService = geminiService;
    }

    public List<InvestigationEntity> listAll() {
        return repository.findAllByOrderByUpdatedAtDesc();
    }

    public Optional<InvestigationEntity> findById(String id) {
        return repository.findById(id);
    }

    public InvestigationEntity create(String question) {
        InvestigationEntity entity = new InvestigationEntity();
        entity.setId("inv-" + UUID.randomUUID().toString().substring(0, 12));
        entity.setQuestion(question.trim());
        entity.setTitle(question.length() > 72 ? question.substring(0, 71) + "…" : question);
        entity.setStatus("investigating");
        entity.setSaved(false);
        entity.setDemo(false);
        entity.setPayloadJson("{}");
        Instant now = Instant.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return repository.save(entity);
    }

    public boolean delete(String id) {
        if (!repository.existsById(id)) {
            return false;
        }
        repository.deleteById(id);
        return true;
    }

    public Optional<InvestigationEntity> addHypothesis(String id, String title, String summary) {
        return repository.findById(id).map(inv -> {
            inv.setUpdatedAt(Instant.now());
            return repository.save(inv);
        });
    }

    public SseEmitter streamResearch(String id) {
        SseEmitter emitter = new SseEmitter(60_000L);
        executor.submit(() -> {
            try {
                InvestigationEntity inv = repository.findById(id).orElseThrow();
                emitter.send(Map.of("type", "progress", "stage", "Understanding your question..."));
                emitter.send(Map.of("type", "progress", "stage", "Exploring competing explanations..."));

                List<String> queries = List.of(
                    inv.getQuestion(),
                    inv.getQuestion() + " research data evidence",
                    inv.getQuestion() + " counterarguments limitations"
                );

                emitter.send(Map.of("type", "progress", "stage", "Searching across sources..."));
                List<CompletableFuture<List<SearchProvider.SearchResult>>> futures = queries.stream()
                    .map(q -> searchProvider.searchAsync(q, 5))
                    .toList();

                List<SearchProvider.SearchResult> allResults = futures.stream()
                    .map(CompletableFuture::join)
                    .flatMap(List::stream)
                    .toList();

                emitter.send(Map.of("type", "progress", "stage", "Comparing evidence..."));
                String structuredJson = geminiService.generateStructuredJson(
                    "Synthesize competing hypotheses, claims, and contradictions for: " + inv.getQuestion()
                        + "\nRetrieved sources count: " + allResults.size()
                );

                inv.setPayloadJson(structuredJson);
                inv.setStatus("complete");
                inv.setUpdatedAt(Instant.now());
                repository.save(inv);

                emitter.send(Map.of("type", "progress", "stage", "Writing the conclusion..."));
                String conclusion = geminiService.generateNaturalResponse(
                    "Sound like a sharp, direct human researcher. Never invent citations.",
                    "Write a natural synthesis for: " + inv.getQuestion() + "\nStructured data:\n" + structuredJson
                );
                emitter.send(Map.of("type", "token", "text", conclusion));
                emitter.send(Map.of("type", "done", "investigation", inv));
                emitter.complete();
            } catch (Exception ex) {
                try {
                    emitter.send(Map.of(
                        "type", "error",
                        "message", "I couldn't complete the web investigation right now. Please try again."
                    ));
                } catch (Exception ignored) {
                    // Client closed stream
                }
                emitter.complete();
            }
        });
        return emitter;
    }

    public SseEmitter streamFollowUp(String id, String message, String actionType) {
        SseEmitter emitter = new SseEmitter(60_000L);
        executor.submit(() -> {
            try {
                InvestigationEntity inv = repository.findById(id).orElseThrow();
                emitter.send(Map.of("type", "progress", "stage", "Reviewing investigation context..."));
                String answer = geminiService.generateNaturalResponse(
                    "You are HYPOTHESIS, a natural human-like research partner.",
                    "Question: " + inv.getQuestion() + "\nContext: " + inv.getPayloadJson() + "\nFollow-up: " + message
                );
                emitter.send(Map.of("type", "token", "text", answer));
                emitter.send(Map.of("type", "done", "investigation", inv));
                emitter.complete();
            } catch (Exception ex) {
                try {
                    emitter.send(Map.of("type", "error", "message", "Unable to process follow-up right now."));
                } catch (Exception ignored) {
                    // Client closed stream
                }
                emitter.complete();
            }
        });
        return emitter;
    }
}
