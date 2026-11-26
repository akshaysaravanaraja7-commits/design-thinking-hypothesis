package com.hypothesis;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class HypothesisApplication {
    public static void main(String[] args) {
        SpringApplication.run(HypothesisApplication.class, args);
    }
}
