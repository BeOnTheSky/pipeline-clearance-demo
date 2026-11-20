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

        // 查询结果中的几何是 GeoJSON，逐条提取顶点后再返回前端。
        for (Pipeline pipeline : pipelineMapper.selectAll()) {
            result.add(toPipelineVO(pipeline, readCoordinates(pipeline.getGeometryJson())));
        }
        return result;
    }

    /** 查询数据库中指定管线的净距与最近点连线。 */
    @Override
    public List<ClearanceVO> listClearances(Long id) {
        // 先确认源管线存在；编号不存在时返回“管线不存在”。
        requirePipeline(id);

        // SQL 计算与其他管线的三维净距，并按净距升序返回。
        return toClearanceVOs(pipelineMapper.selectClearances(id));
    }

    /** 新增管线，使用数据库回填的编号和已校验的数据返回结果。 */
    @Override
    public PipelineVO createPipeline(PipelineRequest request) {
        // 校验属性和顶点，将普通属性与 WKT 放入同一个实体。
        Pipeline pipeline = toPipeline(request);
        double[][] points = objectMapper.convertValue(request.getPoints(), double[][].class);

        // 插入成功后，MyBatis 将数据库生成的编号回填到 pipeline.id。
        pipelineMapper.insertPipeline(pipeline);
        return toPipelineVO(pipeline, points);
    }

    /** 更新已有管线，顶点和半径在同一次写入中保存。 */
    @Override
    public PipelineVO updatePipeline(PipelineRequest request) {
        // 更新时由请求体指定管线编号，新增则使用数据库自增编号。
        if (request.getId() == null || request.getId() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "修改管线时需提供有效编号");
        }

        // 复用新增时的校验和坐标转换，将编号和其他属性一起交给 Mapper。
        Pipeline pipeline = toPipeline(request);
        double[][] points = objectMapper.convertValue(request.getPoints(), double[][].class);

        // 更新行数为零表示管线已不存在。
        if (pipelineMapper.updatePipeline(pipeline) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "管线不存在");
        }

        // 更新成功后，直接返回本次提交并通过校验的数据。
        return toPipelineVO(pipeline, points);
    }

    /** 删除指定管线，编号不存在时返回 404。 */
    @Override
    public void deletePipeline(Long id) {
        // 根据删除行数判断编号是否存在，一次 SQL 完成删除和结果判断。
        if (pipelineMapper.deletePipeline(id) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "管线不存在");
        }
    }

    /** 确认指定编号对应一条已保存管线。 */
    private void requirePipeline(Long id) {
        // 这里只判断记录是否存在，不读取管线的属性和几何数据。
        if (!pipelineMapper.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "管线不存在");
        }
    }

    /**
     * 校验管线属性和三维顶点，生成用于保存的 WKT 几何文本。
     * 每个顶点按“X Y Z”排列，顶点之间用逗号分隔，连接顺序与表单一致。
     * 例如两个顶点 [-5, 0, -1.5]、[5, 0, -1.5] 会生成：
     * LINESTRING Z (-5.0 0.0 -1.5, 5.0 0.0 -1.5)。
     *
     * @param request 新建或编辑管线时提交的属性和顶点
     * @return 交给 SQL 中 ST_GeomFromText 转换的三维折线文本
     */
    private String validateAndBuildWkt(PipelineRequest request) {
        // 名称去掉首尾空白后为 1～80 个字符，与数据库字段长度对应。
        if (request.getName() == null || request.getName().isBlank()
                || request.getName().strip().length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "管线名称需为 1～80 个字符");
        }

        // 类型限定为供水、燃气、排水、电力和通信。
        if (request.getType() == null || !PIPELINE_TYPES.contains(request.getType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请选择管线类型");
        }

        // 外半径必须大于零；isFinite 排除 NaN 和正负无穷值。
        if (request.getRadiusM() == null || !Double.isFinite(request.getRadiusM())
                || request.getRadiusM() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "外半径须大于 0");
        }

        // 一条折线至少有两个顶点，按数组下标依次连接。
        Double[][] points = request.getPoints();
        if (points == null || points.length < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "至少需要两个三维顶点");
        }

        // StringJoiner 自动添加逗号、前缀和右括号；Z 表示每个顶点包含高程。
        StringJoiner coordinates = new StringJoiner(", ", "LINESTRING Z (", ")");
        for (int index = 0; index < points.length; index++) {
            Double[] point = points[index];

            // 每个点必须恰好包含 X、Y、Z 三个有限数值，错误信息使用从 1 开始的点号。
            if (point == null || point.length != 3
                    || Arrays.stream(point).anyMatch(value -> value == null || !Double.isFinite(value))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "第 " + (index + 1) + " 个顶点需包含有效的 X、Y、Z 坐标");
            }

            // 相邻重合点不能形成一段圆管。
            if (index > 0 && samePoint(point, points[index - 1])) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "相邻顶点不能重合");
            }

            // 一个顶点内部用空格分隔 XYZ，顶点之间的逗号由 StringJoiner 添加。
            coordinates.add(point[0] + " " + point[1] + " " + point[2]);
        }

        // 返回完整的 LINESTRING Z (...)，此处只生成文本，实际写入由 Mapper 完成。
        return coordinates.toString();
    }

    /** 比较相邻顶点，正零和负零视为同一坐标。 */
    private boolean samePoint(Double[] first, Double[] second) {
        // 转为基本类型后按数值比较，三个坐标都相等才是同一个点。
        return first[0].doubleValue() == second[0].doubleValue()
                && first[1].doubleValue() == second[1].doubleValue()
                && first[2].doubleValue() == second[2].doubleValue();
    }

    /** 校验请求，并将普通属性和三维折线 WKT 组装为写入实体。 */
    private Pipeline toPipeline(PipelineRequest request) {
        // 先校验名称、类型、半径和顶点，再组装用于数据库写入的属性。
        String geometryWkt = validateAndBuildWkt(request);
        Pipeline pipeline = new Pipeline();

        // 编号用于更新；新增 SQL 不提交编号，插入后由 MyBatis 回填自增值。
        pipeline.setId(request.getId());

        // 名称去掉首尾空白，类型和外半径使用校验通过的提交值。
        pipeline.setName(request.getName().strip());
        pipeline.setType(request.getType());
        pipeline.setRadiusM(request.getRadiusM());
        pipeline.setGeometryWkt(geometryWkt);
        return pipeline;
    }

    /** 将管线属性和 XYZ 顶点组装为前端模型所需的信息。 */
    private PipelineVO toPipelineVO(Pipeline pipeline, double[][] points) {
        PipelineVO result = new PipelineVO();

        // 复制编号、名称等普通属性，供管线选择框和属性面板显示。
        result.setId(pipeline.getId());
        result.setName(pipeline.getName());
        result.setType(pipeline.getType());
        result.setRadiusM(pipeline.getRadiusM());

        // 查询时使用 GeoJSON 中的顶点，保存时使用已校验的提交顶点。
        result.setPoints(points);
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

            // 最短连线也是三维折线：第一个端点在源管线，第二个端点在目标管线。
            clearance.setShortestLine(readCoordinates(row.getShortestLineJson()));
            result.add(clearance);
        }
        return result;
    }

    /** 提取 GeoJSON 的三维坐标数组。 */
    private double[][] readCoordinates(String geometryJson) {
        try {
            // 将 GeoJSON 字符串解析为 JSON 树，读取其中的 coordinates 数组。
            JsonNode geometry = objectMapper.readTree(geometryJson);
            JsonNode coordinates = geometry.required("coordinates");

            // 外层数组对应各个顶点，内层 double[] 保存一个顶点的 X、Y、Z。
            return objectMapper.treeToValue(coordinates, double[][].class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("数据库返回的空间 JSON 无法解析", exception);
        }
    }
}
