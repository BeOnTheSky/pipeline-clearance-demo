"""运行中的 PostGIS 接口检查：python scripts/check-api.py [服务地址]。"""

import json
import math
import sys
import urllib.error
import urllib.request

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"


def get(path):
    """读取接口 JSON，HTTP 错误保留状态码。"""
    with urllib.request.urlopen(BASE_URL + path, timeout=15) as response:
        body = json.load(response)
        assert body["code"] == response.status == 200
        assert body["message"] == "成功"
        return body["data"]


def check_error(path, expected_status):
    """检查错误响应的状态码和消息。"""
    try:
        get(path)
        raise AssertionError("Expected HTTP error")
    except urllib.error.HTTPError as error:
        assert error.code == expected_status
        body = json.load(error)
        assert body["code"] == expected_status
        assert body["message"]
        assert "data" not in body


def main():
    """校验三维净距、最近点连线和返回顺序。"""
    pipelines = get("/api/pipelines")
    assert len(pipelines) == 14
    pipelines_by_id = {pipeline["id"]: pipeline for pipeline in pipelines}
    assert pipelines_by_id[3]["points"] == [[-5, -3, -3.2], [5, 3, -1.8]]
    assert len(pipelines_by_id[4]["points"]) == 4

    for pipeline in pipelines:
        rows = get(f"/api/pipelines/{pipeline['id']}/clearances")
        assert len(rows) == len(pipelines) - 1
        assert {row["targetId"] for row in rows} == set(pipelines_by_id) - {pipeline["id"]}
        values = [row["clearanceM"] for row in rows]
        assert values == sorted(values)

        # 连线长度等于中心线距离，净距扣除两条管线的外半径。
        for row in rows:
            points = row["shortestLine"]
            assert len(points) == 2
            assert all(len(point) == 3 for point in points)
            assert math.isclose(math.dist(*points), row["centerDistanceM"], abs_tol=1e-10)
            target = pipelines_by_id[row["targetId"]]
            expected = row["centerDistanceM"] - pipeline["radiusM"] - target["radiusM"]
            assert math.isclose(row["clearanceM"], expected, abs_tol=1e-10)

    # A/B 的三维中心线距离为 0.6 米，外壁净距为 0.35 米。
    rows = get("/api/pipelines/1/clearances")
    ab = next(row for row in rows if row["targetId"] == 2)
    assert math.isclose(ab["centerDistanceM"], 0.6, abs_tol=1e-10)
    assert math.isclose(ab["clearanceM"], 0.35, abs_tol=1e-10)
    assert any(row["clearanceM"] < 0 for row in get("/api/pipelines/3/clearances"))

    check_error("/api/pipelines/9999/clearances", 404)
    check_error("/api/pipelines/abc/clearances", 400)
    assert get("/api/pipelines") == pipelines
    print("PASS: 14 pipelines, sorted 3D clearances, shortest lines, negative clearance, 400/404")


if __name__ == "__main__":
    main()
