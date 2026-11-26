package com.hypothesis.repository;

import com.hypothesis.model.InvestigationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvestigationJpaRepository extends JpaRepository<InvestigationEntity, String> {
    List<InvestigationEntity> findAllByOrderByUpdatedAtDesc();
}
