package com.example.pipeline.mapper;

import com.example.pipeline.entity.ClearanceRow;
import com.example.pipeline.entity.Pipeline;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface PipelineMapper {

    /** 按编号读取所有管线，空间字段转为三维 GeoJSON。 */
    List<Pipeline> selectAll();

    /** 读取单条管线，供保存后返回完整数据。 */
    Pipeline selectById(@Param("id") Long id);

    /** 检查源管线编号是否存在。 */
    boolean existsById(@Param("id") Long id);

    /** 一次查询全部目标管线的三维距离、净距和最近点连线。 */
    List<ClearanceRow> selectClearances(@Param("id") Long id);

    /** 插入管线，通过数据库序列生成编号。 */
    int insertPipeline(@Param("pipeline") Pipeline pipeline, @Param("geometryWkt") String geometryWkt);

    /** 修改管线属性及三维折线。 */
    int updatePipeline(@Param("pipeline") Pipeline pipeline, @Param("geometryWkt") String geometryWkt);

    /** 按编号删除管线，返回影响行数。 */
    int deletePipeline(@Param("id") Long id);
}
