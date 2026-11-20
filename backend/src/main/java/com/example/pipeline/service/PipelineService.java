package com.example.pipeline.service;

import com.example.pipeline.dto.PipelineRequest;
import com.example.pipeline.vo.ClearanceVO;
import com.example.pipeline.vo.PipelineVO;
import java.util.List;

public interface PipelineService {

    /** 获取全部管线及其三维中心线顶点。 */
    List<PipelineVO> listPipelines();

    /** 查询指定管线与其他管线的净距，按净距升序返回。 */
    List<ClearanceVO> listClearances(Long id);

    /** 新增管线并返回保存后的数据。 */
    PipelineVO createPipeline(PipelineRequest request);

    /** 根据请求中的编号更新管线，并返回保存后的数据。 */
    PipelineVO updatePipeline(PipelineRequest request);

    /** 删除指定管线。 */
    void deletePipeline(Long id);
}
