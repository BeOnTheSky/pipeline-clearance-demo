package com.example.pipeline.controller;

import com.example.pipeline.common.Result;
import com.example.pipeline.dto.PipelineRequest;
import com.example.pipeline.service.PipelineService;
import com.example.pipeline.vo.ClearanceVO;
import com.example.pipeline.vo.PipelineVO;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 提供管线管理和三维净距分析接口。
 */
@RestController
@RequestMapping("/api/pipelines")
public class PipelineController {

    @Autowired
    private PipelineService pipelineService;

    /** 返回全部管线及其三维顶点。 */
    @GetMapping
    public Result<List<PipelineVO>> listPipelines() {
        return Result.success(pipelineService.listPipelines());
    }

    /** 查询已保存管线与其他管线的净距。 */
    @GetMapping("/{id}/clearances")
    public Result<List<ClearanceVO>> listClearances(@PathVariable Long id) {
        return Result.success(pipelineService.listClearances(id));
    }

    /** 保存新管线，返回数据库分配的编号。 */
    @PostMapping
    public Result<PipelineVO> createPipeline(@RequestBody PipelineRequest request) {
        return Result.success(pipelineService.createPipeline(request));
    }

    /** 保存指定管线的名称、类型、半径和三维顶点。 */
    @PutMapping
    public Result<PipelineVO> updatePipeline(@RequestBody PipelineRequest request) {
        return Result.success(pipelineService.updatePipeline(request));
    }

    /** 删除指定管线。 */
    @DeleteMapping("/{id}")
    public Result<Void> deletePipeline(@PathVariable Long id) {
        pipelineService.deletePipeline(id);
        return Result.success();
    }
}
