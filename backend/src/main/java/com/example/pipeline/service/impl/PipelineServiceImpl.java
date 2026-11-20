package com.example.pipeline.service.impl;

import com.example.pipeline.dto.PipelineRequest;
import com.example.pipeline.entity.ClearanceRow;
import com.example.pipeline.entity.Pipeline;
import com.example.pipeline.mapper.PipelineMapper;
import com.example.pipeline.service.PipelineService;
import com.example.pipeline.vo.ClearanceVO;
import com.example.pipeline.vo.PipelineVO;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.StringJoiner;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 管理三维管线，将顶点转换为空间折线并查询净距。
 */
@Service
public class PipelineServiceImpl implements PipelineService {

    private static final Set<String> PIPELINE_TYPES = Set.of("供水", "燃气", "排水", "电力", "通信");

    @Autowired
    private PipelineMapper pipelineMapper;

    @Autowired
    private ObjectMapper objectMapper;

    /** 读取全部管线，转换空间坐标后返回。 */
    @Override
    public List<PipelineVO> listPipelines() {
        List<PipelineVO> result = new ArrayList<>();
        for (Pipeline pipeline : pipelineMapper.selectAll()) {
            result.add(toPipelineVO(pipeline));
        }
        return result;
    }

    /** 查询数据库中指定管线的净距与最近点连线。 */
    @Override
    public List<ClearanceVO> listClearances(Long id) {
        requirePipeline(id);
        return toClearanceVOs(pipelineMapper.selectClearances(id));
    }

    /** 新增管线，使用数据库生成的编号查询保存结果。 */
    @Override
    @Transactional
    public PipelineVO createPipeline(PipelineRequest request) {
        String geometryWkt = validateAndBuildWkt(request);
        Pipeline pipeline = toPipeline(request);
        pipelineMapper.insertPipeline(pipeline, geometryWkt);
        return toPipelineVO(pipelineMapper.selectById(pipeline.getId()));
    }

    /** 更新已有管线，顶点和半径在同一次写入中保存。 */
    @Override
    @Transactional
    public PipelineVO updatePipeline(Long id, PipelineRequest request) {
        String geometryWkt = validateAndBuildWkt(request);
        Pipeline pipeline = toPipeline(request);
        pipeline.setId(id);

        // 更新行数为零表示管线已不存在。
        if (pipelineMapper.updatePipeline(pipeline, geometryWkt) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "管线不存在");
        }
        return toPipelineVO(pipelineMapper.selectById(id));
    }

    /** 删除指定管线，编号不存在时返回 404。 */
    @Override
    public void deletePipeline(Long id) {
        if (pipelineMapper.deletePipeline(id) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "管线不存在");
        }
    }

    /** 确认指定编号对应一条已保存管线。 */
    private void requirePipeline(Long id) {
        if (!pipelineMapper.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "管线不存在");
        }
    }

    /** 校验名称、半径和顶点，按连接顺序组装 LINESTRING Z。 */
    private String validateAndBuildWkt(PipelineRequest request) {
        if (request.getName() == null || request.getName().isBlank()
                || request.getName().strip().length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "管线名称需为 1～80 个字符");
        }
        if (request.getType() == null || !PIPELINE_TYPES.contains(request.getType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择管线类型");
        }
        if (request.getRadiusM() == null || !Double.isFinite(request.getRadiusM())
                || request.getRadiusM() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "外半径须大于 0");
        }

        Double[][] points = request.getPoints();
        if (points == null || points.length < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "至少需要两个三维顶点");
        }
        StringJoiner coordinates = new StringJoiner(", ", "LINESTRING Z (", ")");
        for (int index = 0; index < points.length; index++) {
            Double[] point = points[index];
            if (point == null || point.length != 3
                    || Arrays.stream(point).anyMatch(value -> value == null || !Double.isFinite(value))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "第 " + (index + 1) + " 个顶点需包含有效的 X、Y、Z 坐标");
            }

            // 相邻重合点不能形成一段圆管。
            if (index > 0 && samePoint(point, points[index - 1])) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "相邻顶点不能重合");
            }
            coordinates.add(point[0] + " " + point[1] + " " + point[2]);
        }
        return coordinates.toString();
    }

    /** 比较相邻顶点，正零和负零视为同一坐标。 */
    private boolean samePoint(Double[] first, Double[] second) {
        return first[0].doubleValue() == second[0].doubleValue()
                && first[1].doubleValue() == second[1].doubleValue()
                && first[2].doubleValue() == second[2].doubleValue();
    }

    /** 将提交的普通属性复制到写入对象。 */
    private Pipeline toPipeline(PipelineRequest request) {
        Pipeline pipeline = new Pipeline();
        pipeline.setName(request.getName().strip());
        pipeline.setType(request.getType());
        pipeline.setRadiusM(request.getRadiusM());
        return pipeline;
    }

    /** 将数据库管线转换为前端模型所需的信息。 */
    private PipelineVO toPipelineVO(Pipeline pipeline) {
        PipelineVO result = new PipelineVO();
        result.setId(pipeline.getId());
        result.setName(pipeline.getName());
        result.setType(pipeline.getType());
        result.setRadiusM(pipeline.getRadiusM());
        /*
            {-5.0, 0.0, -1.5},
            {5.0, 0.0, -1.5}
        */
        result.setPoints(readCoordinates(pipeline.getGeometryJson()));
        return result;
    }

    /** 转换距离字段和最近点连线的三维端点。 */
    private List<ClearanceVO> toClearanceVOs(List<ClearanceRow> rows) {
        List<ClearanceVO> result = new ArrayList<>(rows.size());
        for (ClearanceRow row : rows) {
            ClearanceVO clearance = new ClearanceVO();
            clearance.setTargetId(row.getTargetId());
            clearance.setTargetName(row.getTargetName());

            // 保留 PostGIS 返回的中心线距离和外壁净距。
            clearance.setCenterDistanceM(row.getCenterDistanceM());
            clearance.setClearanceM(row.getClearanceM());
            clearance.setShortestLine(readCoordinates(row.getShortestLineJson()));
            result.add(clearance);
        }
        return result;
    }

    /** 提取 GeoJSON 的三维坐标数组。 */
    private double[][] readCoordinates(String geometryJson) {
        try {
            JsonNode geometry = objectMapper.readTree(geometryJson);
            JsonNode coordinates = geometry.required("coordinates");
            return objectMapper.treeToValue(coordinates, double[][].class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("数据库返回的空间 JSON 无法解析", exception);
        }
    }
}
