package com.example.pipeline.entity;

import lombok.Data;

/**
 * 管线数据对象，写入使用 WKT，查询时由 PostGIS 返回 GeoJSON。
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
     * 写入数据库的三维折线文本，由 ST_GeomFromText 转为空间几何。
     */
    private String geometryWkt;

    /**
     * 中心线 GeoJSON，coordinates 保留 X、Y、Z 三维坐标。
        {
        "type": "LineString",
        "coordinates": [
            [-5, 0, -1.5],
            [5, 0, -1.5]
        ]
        }
        ST_AsGeoJSON(geom, 15) 的意思是：把数据库中的几何对象 geom
        转成 GeoJSON 文本，坐标最多保留 15 位小数。
     */
    private String geometryJson;
}
