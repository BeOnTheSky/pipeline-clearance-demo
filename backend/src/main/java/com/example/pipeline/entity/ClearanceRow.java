package com.example.pipeline.entity;

import lombok.Data;

/**
 * 选中管线与一条目标管线的空间查询结果。
 */
@Data
public class ClearanceRow {

    /**
     * 目标管线编号。
     */
    private Long targetId;

    /**
     * 目标管线名称。
     */
    private String targetName;

    /**
     * 两条中心线的三维最短距离，单位：米。
     */
    private double centerDistanceM;

    /**
     * 中心线距离减去两管外半径，单位：米，可为负值。
     */
    private double clearanceM;

    /**
     * 最短中心线连线的 GeoJSON，起点位于选中管线，终点位于目标管线。
     */
    private String shortestLineJson;
}
