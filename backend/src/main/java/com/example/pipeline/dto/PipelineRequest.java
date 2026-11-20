package com.example.pipeline.dto;

import lombok.Data;

/**
 * 新建和编辑管线时提交的数据。
 */
@Data
public class PipelineRequest {

    /** 管线名称。 */
    private String name;

    /** 管线类型：供水、燃气、排水、电力、通信。 */
    private String type;

    /** 外半径，单位：米。 */
    private Double radiusM;

    /** 按连接顺序排列的三维顶点，格式为 [[x, y, z], ...]。 */
    private Double[][] points;
}
