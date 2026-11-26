package com.hypothesis.controller;

import com.hypothesis.model.InvestigationEntity;
import com.hypothesis.service.InvestigationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/investigations")
public class InvestigationController {

    private final InvestigationService investigationService;

    public InvestigationController(InvestigationService investigationService) {
        this.investigationService = investigationService;
    }

    public record CreateInvestigationRequest(
        @NotBlank @Size(min = 3, max = 1000) String question
    ) {}

    public record MessageRequest(
        @NotBlank @Size(min = 1, max = 1500) String message,
        String actionType
    ) {}

    public record AddHypothesisRequest(
        @NotBlank @Size(min = 3, max = 160) String title,
        @Size(max = 500) String summary
    ) {}

    public record ChallengeRequest(String claimId, String claimText) {}

    public record DeeperRequest(String target, String mode) {}

    @GetMapping
    public Map<String, List<InvestigationEntity>> list() {
        return Map.of("investigations", investigationService.listAll());
    }

    @PostMapping
    public ResponseEntity<Map<String, InvestigationEntity>> create(
        @Valid @RequestBody CreateInvestigationRequest request
    ) {
        InvestigationEntity created = investigationService.create(request.question());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("investigation", created));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, InvestigationEntity>> get(@PathVariable String id) {
        return investigationService.findById(id)
            .map(inv -> ResponseEntity.ok(Map.of("investigation", inv)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable String id) {
        boolean removed = investigationService.delete(id);
        return removed
            ? ResponseEntity.ok(Map.of("deleted", true, "id", id))
            : ResponseEntity.notFound().build();
    }

    @PostMapping(value = "/{id}/research", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter research(@PathVariable String id) {
        return investigationService.streamResearch(id);
    }

    @PostMapping(value = "/{id}/message", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter message(
        @PathVariable String id,
        @Valid @RequestBody MessageRequest request
    ) {
        return investigationService.streamFollowUp(id, request.message(), request.actionType());
    }

    @PostMapping("/{id}/hypotheses")
    public ResponseEntity<Map<String, InvestigationEntity>> addHypothesis(
        @PathVariable String id,
        @Valid @RequestBody AddHypothesisRequest request
    ) {
        return investigationService.addHypothesis(id, request.title(), request.summary())
            .map(inv -> ResponseEntity.status(HttpStatus.CREATED).body(Map.of("investigation", inv)))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/{id}/challenge", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter challenge(
        @PathVariable String id,
        @RequestBody ChallengeRequest request
    ) {
        String prompt = "Challenge this claim and find opposing evidence: " + request.claimText();
        return investigationService.streamFollowUp(id, prompt, "challenge");
    }

    @PostMapping(value = "/{id}/deeper", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter deeper(
        @PathVariable String id,
        @RequestBody DeeperRequest request
    ) {
        String prompt = "Investigate deeper (" + request.mode() + "): " + request.target();
        return investigationService.streamFollowUp(id, prompt, request.mode());
    }

    @GetMapping("/{id}/graph")
    public ResponseEntity<Map<String, Object>> graph(@PathVariable String id) {
        return investigationService.findById(id)
            .map(inv -> ResponseEntity.ok(Map.<String, Object>of("id", inv.getId(), "payloadJson", inv.getPayloadJson())))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/sources")
    public ResponseEntity<Map<String, Object>> sources(@PathVariable String id) {
        return investigationService.findById(id)
            .map(inv -> ResponseEntity.ok(Map.<String, Object>of("id", inv.getId(), "payloadJson", inv.getPayloadJson())))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/claims")
    public ResponseEntity<Map<String, Object>> claims(@PathVariable String id) {
        return investigationService.findById(id)
            .map(inv -> ResponseEntity.ok(Map.<String, Object>of("id", inv.getId(), "payloadJson", inv.getPayloadJson())))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
