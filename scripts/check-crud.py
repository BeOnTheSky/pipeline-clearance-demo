"""管线新增、编辑、分析和删除检查；仅清理本脚本创建的数据。"""
import concurrent.futures
import json
import math
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080'


def request(method, path, body=None, expected=200):
    """发送 JSON 并验证状态码。"""
    data = None if body is None else json.dumps(body).encode('utf-8')
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            assert response.status == expected, response.status
            result = json.load(response)
            assert result['code'] == expected
            assert result['message']
            return result.get('data')
    except urllib.error.HTTPError as error:
        details = error.read().decode()
        assert error.code == expected, (error.code, details)
        result = json.loads(details)
        assert result['code'] == expected
        assert 'data' not in result
        return result


def main():
    """检查真实 PostGIS 写入、编号生成、净距和输入校验。"""
    original = request('GET', '/api/pipelines')
    created = []
    sample = {'name': '  __api_check_' + str(time.time_ns()) + '  ', 'type': '供水',
              'radiusM': 0.1, 'points': [[-5, 0, -1.5], [5, 0, -1.5]]}
    try:
        saved = request('POST', '/api/pipelines', sample)
        created.append(saved['id'])
        assert saved['points'] == sample['points']
        assert saved['name'] == sample['name'].strip()
        assert saved['id'] not in {p['id'] for p in original}

        # 保存接口直接返回实体数据，独立查询确认编号、名称和顶点已实际写入。
        reloaded = next(p for p in request('GET', '/api/pipelines') if p['id'] == saved['id'])
        assert reloaded == saved
        rows = request('GET', f"/api/pipelines/{saved['id']}/clearances")
        assert len(rows) == len(original)
        ab = next(row for row in rows if row['targetId'] == 2)
        assert math.isclose(ab['clearanceM'], 0.35, abs_tol=1e-10)

        # 插入中间点并改变半径和高度，重新查询数据库结果。
        edited = {**sample, 'id': saved['id'], 'radiusM': 0.12, 'type': '排水',
                  'points': [[-5, 0, -1.3], [0, 0, -1.3], [5, 0, -1.3]]}
        updated = request('PUT', '/api/pipelines', edited)
        assert updated['points'] == edited['points']
        assert updated['radiusM'] == 0.12 and updated['type'] == '排水'
        reloaded = next(p for p in request('GET', '/api/pipelines') if p['id'] == saved['id'])
        assert reloaded == updated
        rows = request('GET', f"/api/pipelines/{saved['id']}/clearances")
        ab = next(row for row in rows if row['targetId'] == 2)
        assert math.isclose(ab['clearanceM'], 0.53, abs_tol=1e-10)
        assert all(row['targetId'] != saved['id'] for row in rows)
        assert [r['clearanceM'] for r in rows] == sorted(r['clearanceM'] for r in rows)
        for row in rows:
            assert math.isclose(math.dist(*row['shortestLine']), row['centerDistanceM'], abs_tol=1e-10)

        # 无效数据不得写入；返回的 message 可直接显示在表单中。
        for change in [{'name': ' '}, {'name': 'a' * 81}, {'type': '未知'},
                       {'radiusM': 0}, {'radiusM': -1}, {'radiusM': None},
                       {'points': [[0, 0, -1]]}, {'points': [[0, 0], [1, 0, -1]]},
                       {'points': [[0, None, -1], [1, 0, -1]]},
                       {'points': [[0, 0, -1], [-0.0, 0, -1]]}]:
            error = request('POST', '/api/pipelines', {**sample, **change}, 400)
            assert error.get('message')
        for invalid_id in [None, 0, -1]:
            request('PUT', '/api/pipelines', {**sample, 'id': invalid_id}, 400)
        request('PUT', '/api/pipelines', {**sample, 'id': 99999999}, 404)
        request('DELETE', '/api/pipelines/99999999', expected=404)
        assert len(request('GET', '/api/pipelines')) == len(original) + 1

        # 新增始终使用自增编号，即使请求携带已有编号，也不会覆盖原有管线。
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(request, 'POST', '/api/pipelines',
                                   {**sample, 'id': saved['id'], 'name': sample['name'] + '_' + str(i)})
                       for i in range(4)]
            for future in futures:
                created.append(future.result()['id'])
        assert len(set(created)) == 5
        print('PASS: create, generated IDs, edit vertices/radius, saved analysis, validation, concurrent IDs')
    finally:
        for pipeline_id in created:
            request('DELETE', f'/api/pipelines/{pipeline_id}', expected=200)
        assert request('GET', '/api/pipelines') == original
        print('PASS: delete and unchanged original pipelines')


if __name__ == '__main__':
    main()
