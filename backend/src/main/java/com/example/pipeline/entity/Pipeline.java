package com.example.pipeline.entity;

import lombok.Data;

/**
 * 管线查询映射对象，空间字段由 PostGIS 转为 GeoJSON。
 */
@Data
public class Pipeline {

    /**
     * 管线编号。
     */
    private Long id;

    /**
     * 管线名称。
     */
    private String name;

    /**
     * 业务类型，例如供水、燃气、排水。
     */
    private String type;

    /**
     * 管线外半径，单位：米。
     */
    private double radiusM;

    /**
     * 中心线 GeoJSON，coordinates 保留 X、Y、Z 三维坐标。
     */
    private String geometryJson;
}
