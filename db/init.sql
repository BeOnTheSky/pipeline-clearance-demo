BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
-- 建表时：规定 geom 字段保存三维折线，SRID 为 0。表示没有指定已知的空间参考系统
CREATE TABLE pipeline (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    type VARCHAR(20) NOT NULL,
    radius_m DOUBLE PRECISION NOT NULL CHECK (radius_m > 0),
    geom geometry(LineStringZ, 0) NOT NULL
);

-- 初始管网包含直线、折线、倾斜段和跨层连接。
INSERT INTO pipeline (id, name, type, radius_m, geom) VALUES
    (1, 'A · 供水主管', '供水', 0.10,
        ST_GeomFromText('LINESTRING Z (-5 0 -1.5, 5 0 -1.5)', 0)
    ),
    (2, 'B · 燃气支管', '燃气', 0.15,
        ST_GeomFromText('LINESTRING Z (0 -5 -2.1, 0 5 -2.1)', 0)
    ),
    (3, 'C · 倾斜排水管', '排水', 0.20,
        ST_GeomFromText('LINESTRING Z (-5 -3 -3.2, 5 3 -1.8)', 0)
    ),
    (4, 'D · 折线供水管', '供水', 0.12,
        ST_GeomFromText('LINESTRING Z (-6 3 -1.2, -2 3 -1.2, -2 6 -1.8, 4 6 -1.8)', 0)
    ),
    (5, 'E · 近距燃气管', '燃气', 0.10,
        ST_GeomFromText('LINESTRING Z (-4 0.35 -1.5, 4 0.35 -1.5)', 0)
    ),
    (6, 'F · 远端排水管', '排水', 0.25,
        ST_GeomFromText('LINESTRING Z (-6 -6 -3.5, 6 -6 -3.5)', 0)
    ),
    (7, 'G · 电力套管', '电力', 0.08,
        ST_GeomFromText('LINESTRING Z (3 -4 -0.8, 3 4 -0.8)', 0)
    ),
    (8, 'H · 通信套管', '通信', 0.06,
        ST_GeomFromText('LINESTRING Z (-4 -4 -0.7, -4 5 -0.7)', 0)
    ),
    (9, 'I · 重叠示例管', '排水', 0.12,
        ST_GeomFromText('LINESTRING Z (1 -3 -2.15, 1 3 -2.15)', 0)
    ),
    (10, 'J · 横向燃气管', '燃气', 0.10,
        ST_GeomFromText('LINESTRING Z (-5 4 -2.6, 5 4 -2.6)', 0)
    ),
    (11, 'K · 北区供水环线', '供水', 0.16,
        ST_GeomFromText('LINESTRING Z (-12 7 -1.4, -7 7 -1.4, -7 10 -1.6, 7 10 -1.6, 7 7 -1.4, 12 7 -1.4)', 0)
    ),
    (15, 'O · 深层排水干管', '排水', 0.30,
        ST_GeomFromText('LINESTRING Z (-13 -10 -4.7, -7 -7 -4.4, -2 -7 -4, 5 -2 -3.7, 10 5 -3.4, 13 11 -3.1)', 0)
    ),
    (20, 'T · 西区通信环线', '通信', 0.07,
        ST_GeomFromText('LINESTRING Z (-11 -11 -0.65, -11 9 -0.65, -6 9 -0.65, -6 12 -0.65)', 0)
    ),
    (22, 'V · 中路供水跨层管', '供水', 0.14,
        ST_GeomFromText('LINESTRING Z (-12 -2 -1.4, -3 -2 -1.4, -3 -2 -3, 4 -2 -3, 4 -2 -1.4, 12 -2 -1.4)', 0)
    );

-- 初始数据指定了编号，后续新增从最大编号继续递增。
SELECT setval('pipeline_id_seq', (SELECT MAX(id) FROM pipeline));

COMMIT;
