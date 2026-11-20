package com.example.pipeline.vo;

import lombok.Data;

/**
 * 返回前端的单条净距分析结果。
 */
@Data
public class ClearanceVO {

    /**
     * 目标管线编号。
     */
    private Long targetId;

    /**
     * 目标管线名称。
     */
    private String targetName;

    /**
     * 三维中心线最短距离，单位：米。
     */
    private double centerDistanceM;

    /**
     * 简化外壁净距，单位：米，保留负值。
     */
    private double clearanceM;

    /**
     * 最近点连线的两个三维端点，顺序为选中管线、目标管线。
     */
    private double[][] shortestLine;
}
