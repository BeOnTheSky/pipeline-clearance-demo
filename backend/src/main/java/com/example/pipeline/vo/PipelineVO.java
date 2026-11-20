package com.example.pipeline.vo;

import lombok.Data;

/**
 * 返回前端的管线信息，用于绘制三维模型。
 */
@Data
public class PipelineVO {

    /**
     * 管线编号。
     */
    private Long id;

    /**
     * 管线名称。
     */
    private String name;

    /**
     * 管线业务类型，用于区分模型颜色。
     */
    private String type;

    /**
     * 管线外半径，单位：米。
     */
    private double radiusM;

    /**
     * 中心线顶点，格式为 [[x, y, z], ...]，单位：米。
     */
    private double[][] points;
}
